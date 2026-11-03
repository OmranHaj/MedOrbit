import { Router, type IRouter } from "express";
import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, doctorsTable, pendingVisitsTable } from "@workspace/db";
import {
  StartRepresentativeSessionResponse, StartClinicDemoSessionResponse,
  ListPendingVisitsResponse, StartPendingVisitBody, StartPendingVisitResponse,
  VerifyPendingVisitBody, VerifyPendingVisitParams, VerifyPendingVisitResponse,
  ListClinicDemoVisitsQueryParams, ListClinicDemoVisitsResponse,
} from "@workspace/api-zod";
import { ensureDemoSession, getDemoSession } from "../lib/demo-session";
import { clearExpiredOtpSecrets, databaseNow, decryptClinicCode, encryptClinicCode, hashOtp,
  matchesOtp, MAX_ATTEMPTS, otpContext, pendingView } from "../lib/visit-otp";

const router: IRouter = Router();

router.post("/verification/representative-session", async (req, res): Promise<void> => {
  res.json(StartRepresentativeSessionResponse.parse(await ensureDemoSession(req, res, "representative")));
});
router.post("/clinic-demo/session", async (req, res): Promise<void> => {
  res.json(StartClinicDemoSessionResponse.parse(await ensureDemoSession(req, res, "clinic_demo")));
});

router.get("/pending-visits", async (req, res): Promise<void> => {
  const representative = await getDemoSession(req, "representative");
  if (!representative) { res.status(401).json({ error: "ابدأ جلسة مندوب تجريبية أولًا أو أعد تفعيلها." }); return; }
  await clearExpiredOtpSecrets();
  const result = await db.transaction(async (tx) => {
    const rows = await tx.select({ pending: pendingVisitsTable, doctorName: doctorsTable.name }).from(pendingVisitsTable)
      .innerJoin(doctorsTable, eq(pendingVisitsTable.doctorId, doctorsTable.id))
      .where(eq(pendingVisitsTable.representativeId, representative.id))
      .orderBy(desc(pendingVisitsTable.createdAt)).limit(1);
    const now = await databaseNow(tx);
    return rows.map(({ pending, doctorName }) => pendingView(pending, doctorName, now));
  });
  res.json(ListPendingVisitsResponse.parse(result));
});

router.post("/pending-visits", async (req, res): Promise<void> => {
  const representative = await getDemoSession(req, "representative");
  if (!representative) { res.status(401).json({ error: "ابدأ جلسة مندوب تجريبية أولًا." }); return; }
  const parsed = StartPendingVisitBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "اختر طبيبًا صحيحًا. هوية المندوب يحددها الخادم فقط." }); return; }
  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, parsed.data.doctorId));
  if (!doctor) { res.status(400).json({ error: "الطبيب المحدد غير موجود." }); return; }
  const result = await db.transaction(async (tx) => {
    // Serializes starts per representative so concurrent starts cannot leave two active codes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${representative.id})::bigint)`);
    await tx.update(pendingVisitsTable).set({
      supersededAt: sql`clock_timestamp()`, otpHash: null, clinicEnvelope: null,
    }).where(and(eq(pendingVisitsTable.representativeId, representative.id),
      isNull(pendingVisitsTable.submittedAt), isNull(pendingVisitsTable.supersededAt)));
    const id = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const context = otpContext(id, doctor.id, representative.id);
    const [pending] = await tx.insert(pendingVisitsTable).values({
      id, doctorId: doctor.id, representativeId: representative.id,
      otpHash: hashOtp(code, context), clinicEnvelope: encryptClinicCode(code, context),
      expiresAt: sql`clock_timestamp() + interval '5 minutes'`,
    }).returning();
    return pendingView(pending, doctor.name, await databaseNow(tx));
  });
  // Never include code, hash, envelope, session cookie, or token in this response.
  res.status(201).json(StartPendingVisitResponse.parse(result));
});

router.post("/pending-visits/:id/verify", async (req, res): Promise<void> => {
  const representative = await getDemoSession(req, "representative");
  if (!representative) { res.status(401).json({ error: "جلسة المندوب غير موجودة أو منتهية." }); return; }
  const params = VerifyPendingVisitParams.safeParse(req.params);
  const body = VerifyPendingVisitBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "أدخل رمزًا من ستة أرقام للزيارة المحددة." }); return; }
  const result = await db.transaction(async (tx) => {
    const [pending] = await tx.select().from(pendingVisitsTable).where(and(
      eq(pendingVisitsTable.id, params.data.id), eq(pendingVisitsTable.representativeId, representative.id),
    )).for("update");
    if (!pending) return { status: 404, error: "الزيارة غير موجودة أو لا تخص جلسة المندوب الحالية." };
    // Read server DB time after acquiring the lock, not at request/transaction start.
    const now = await databaseNow(tx);
    if (pending.verifiedAt || pending.submittedAt || pending.supersededAt) {
      return { status: 409, error: "استُخدم الرمز بالفعل أو أُلغيت هذه الزيارة. لا يمكن إعادة استخدامه." };
    }
    if (pending.failedAttempts >= MAX_ATTEMPTS) return { status: 429, error: "استُنفدت المحاولات الخمس. ابدأ زيارة معلقة جديدة." };
    if (pending.expiresAt <= now) {
      await tx.update(pendingVisitsTable).set({ otpHash: null, clinicEnvelope: null }).where(eq(pendingVisitsTable.id, pending.id));
      return { status: 410, error: "انتهت صلاحية الرمز بعد خمس دقائق. ابدأ زيارة معلقة جديدة." };
    }
    if (!pending.otpHash || !matchesOtp(body.data.code, otpContext(pending.id, pending.doctorId, representative.id), pending.otpHash)) {
      const attempts = pending.failedAttempts + 1;
      await tx.update(pendingVisitsTable).set({
        failedAttempts: attempts,
        ...(attempts >= MAX_ATTEMPTS ? { otpHash: null, clinicEnvelope: null } : {}),
      }).where(eq(pendingVisitsTable.id, pending.id));
      return {
        status: attempts >= MAX_ATTEMPTS ? 429 : 400,
        error: attempts >= MAX_ATTEMPTS ? "استُنفدت المحاولات الخمس. ابدأ زيارة معلقة جديدة." :
          `الرمز غير صحيح. المحاولات المتبقية: ${MAX_ATTEMPTS - attempts}.`,
      };
    }
    const [updated] = await tx.update(pendingVisitsTable).set({
      verifiedAt: now, otpHash: null, clinicEnvelope: null,
    }).where(eq(pendingVisitsTable.id, pending.id)).returning();
    const [doctor] = await tx.select().from(doctorsTable).where(eq(doctorsTable.id, pending.doctorId));
    return { status: 200, pending: pendingView(updated, doctor.name, now) };
  });
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }
  res.json(VerifyPendingVisitResponse.parse(result.pending));
});

router.get("/clinic-demo/pending-visits", async (req, res): Promise<void> => {
  const clinic = await getDemoSession(req, "clinic_demo");
  if (!clinic) { res.status(401).json({ error: "ابدأ جلسة محاكاة السكرتير من صفحة DEMO أولًا." }); return; }
  const parsed = ListClinicDemoVisitsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "اختيار الطبيب غير صحيح." }); return; }
  await clearExpiredOtpSecrets();
  const result = await db.transaction(async (tx) => {
    const rows = await tx.select({ pending: pendingVisitsTable, doctorName: doctorsTable.name }).from(pendingVisitsTable)
      .innerJoin(doctorsTable, eq(doctorsTable.id, pendingVisitsTable.doctorId))
      .where(and(isNull(pendingVisitsTable.verifiedAt), isNull(pendingVisitsTable.submittedAt),
        isNull(pendingVisitsTable.supersededAt), gt(pendingVisitsTable.expiresAt, sql`clock_timestamp()`),
        lt(pendingVisitsTable.failedAttempts, MAX_ATTEMPTS),
        parsed.data.doctorId ? eq(pendingVisitsTable.doctorId, parsed.data.doctorId) : undefined))
      .orderBy(desc(pendingVisitsTable.createdAt)).limit(100);
    const now = await databaseNow(tx);
    return rows.filter(({ pending }) => pending.clinicEnvelope && pending.expiresAt > now).map(({ pending, doctorName }) => ({
      ...pendingView(pending, doctorName, now),
      code: decryptClinicCode(pending.clinicEnvelope!, otpContext(pending.id, pending.doctorId, pending.representativeId)),
    }));
  });
  res.json(ListClinicDemoVisitsResponse.parse(result));
});

export default router;
