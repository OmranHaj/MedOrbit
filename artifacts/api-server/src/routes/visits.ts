import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, doctorsTable, productsTable, visitsTable, pendingVisitsTable } from "@workspace/db";
import { CreateVisitBody, CreateVisitResponse, ListVisitsQueryParams, ListVisitsResponse } from "@workspace/api-zod";
import { trimFields, validVisitDate } from "../lib/validation";
import { visitsQuery } from "../lib/visit-query";
import { getDemoSession } from "../lib/demo-session";
import { CONFIRMED_STATUS, databaseNow } from "../lib/visit-otp";

const router: IRouter = Router();
router.get("/visits", async (req, res): Promise<void> => {
  const parsed = ListVisitsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "معرّف الطبيب غير صحيح." }); return; }
  res.json(ListVisitsResponse.parse(await visitsQuery().where(
    parsed.data.doctorId ? eq(visitsTable.doctorId, parsed.data.doctorId) : undefined,
  )));
});

router.post("/visits", async (req, res): Promise<void> => {
  const representative = await getDemoSession(req, "representative");
  if (!representative) { res.status(401).json({ error: "ابدأ جلسة مندوب تجريبية وتحقق من الزيارة قبل حفظ التقرير." }); return; }
  const parsed = CreateVisitBody.strict().safeParse(trimFields(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: "اختر الطبيب والمنتج والنتيجة، وأدخل تاريخًا وملاحظات مهنية من ٣ إلى ٢٠٠٠ حرف." }); return;
  }
  if (!validVisitDate(parsed.data.date)) {
    res.status(400).json({ error: "يرجى إدخال تاريخ زيارة صحيح، ليس في المستقبل ولا قبل عام ١٩٠٠." }); return;
  }
  const [[doctor], [product]] = await Promise.all([
    db.select({ id: doctorsTable.id }).from(doctorsTable).where(eq(doctorsTable.id, parsed.data.doctorId)),
    db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, parsed.data.productId)),
  ]);
  if (!doctor || !product) { res.status(400).json({ error: "الطبيب أو المنتج غير موجود. حدّث القائمة وأعد المحاولة." }); return; }
  const saved = await db.transaction(async (tx): Promise<{ id: number } | { status: number; error: string }> => {
    const [pending] = await tx.select().from(pendingVisitsTable).where(and(
      eq(pendingVisitsTable.id, parsed.data.pendingVisitId),
      eq(pendingVisitsTable.representativeId, representative.id),
      eq(pendingVisitsTable.doctorId, parsed.data.doctorId),
    )).for("update");
    if (!pending || !pending.verifiedAt || pending.supersededAt) {
      return { status: 403, error: "يلزم تأكيد هذه الزيارة والطبيب برمز العيادة التجريبي الخاص بجلسة المندوب الحالية." };
    }
    if (pending.submittedAt) return { status: 409, error: "حُفظ تقرير هذه الزيارة بالفعل. لا يمكن استخدام التأكيد مرتين." };
    const [report] = await tx.insert(visitsTable).values({
      ...parsed.data, verificationStatus: CONFIRMED_STATUS,
    }).returning({ id: visitsTable.id });
    await tx.update(pendingVisitsTable).set({ submittedAt: await databaseNow(tx) }).where(eq(pendingVisitsTable.id, pending.id));
    return { id: report.id };
  });
  if ("error" in saved) { res.status(saved.status).json({ error: saved.error }); return; }
  const [visit] = await visitsQuery().where(eq(visitsTable.id, saved.id));
  res.status(201).json(CreateVisitResponse.parse(visit));
});
export default router;
