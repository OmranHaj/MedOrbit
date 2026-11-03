import { Router, type IRouter } from "express";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, doctorsTable, representativesTable, regionAssignmentsTable, regionTransfersTable } from "@workspace/db";
import { GetHandoverStateResponse, GetHandoverSummaryQueryParams, GetMyHandoverDoctorsResponse, SwitchHandoverDemoViewBody, TransferRegionBody } from "@workspace/api-zod";
import { createDemoSession, getDemoSession } from "../lib/demo-session";
import { readAssignment, readRegionSummary } from "../lib/handover";

const router: IRouter = Router();
router.get("/handover", async (req, res) => {
  const session = await getDemoSession(req, "representative");
  const state = await db.transaction(async (tx) => {
    const representatives = await tx.select({ id: representativesTable.id, name: representativesTable.name }).from(representativesTable).orderBy(asc(representativesTable.id));
    const names = new Map(representatives.map((r) => [r.id, r.name]));
    const assignments = await tx.select().from(regionAssignmentsTable).orderBy(asc(regionAssignmentsTable.region));
    const regions = await tx.selectDistinct({ region: doctorsTable.region }).from(doctorsTable);
    const history = await tx.select().from(regionTransfersTable).orderBy(desc(regionTransfersTable.id));
    return {
      representatives,
      regions: [...new Set([...regions.map((r) => r.region), ...assignments.map((a) => a.region)])].sort(),
      assignments: assignments.map((a) => ({ ...a, representativeName: names.get(a.representativeId)! })),
      history: history.map((h) => ({ ...h, fromRepresentativeName: h.fromRepresentativeId ? names.get(h.fromRepresentativeId)! : null, toRepresentativeName: names.get(h.toRepresentativeId)! })),
      demoRepresentativeId: session?.representativeDirectoryId ?? null,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  res.json(GetHandoverStateResponse.parse(state));
});

router.post("/handover/demo-view", async (req, res) => {
  const p = SwitchHandoverDemoViewBody.strict().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: "اختر مندوبًا خياليًا أو منظور المشرف التجريبي." }); return; }
  if (p.data.representativeId !== null) {
    const [r] = await db.select().from(representativesTable).where(eq(representativesTable.id, p.data.representativeId));
    if (!r) { res.status(404).json({ error: "المندوب الخيالي غير موجود." }); return; }
  }
  res.json(await createDemoSession(req, res, "representative", p.data.representativeId));
});

// Deliberately public DEMO API. The supervisor selector is NOT authorization.
router.post("/handover/assignments", async (req, res) => {
  const p = TransferRegionBody.strict().safeParse(req.body);
  if (!p.success || !p.data.region.trim()) { res.status(400).json({ error: "اختر المنطقة والمندوب الوارد ونسخة الإسناد الصحيحة." }); return; }
  const { fromRepresentativeId, toRepresentativeId, expectedVersion } = p.data;
  const region = p.data.region.trim();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${region}, 9137))`);
    const [to] = await tx.select().from(representativesTable).where(eq(representativesTable.id, toRepresentativeId));
    if (!to) return { error: "المندوب الوارد غير موجود.", status: 404 };
    const current = await readAssignment(tx, region);
    if ((current?.version ?? 0) !== expectedVersion || (current?.representativeId ?? null) !== fromRepresentativeId)
      return { error: "تغيّر إسناد المنطقة أثناء العرض. حدّث البيانات وراجع المسؤول الحالي قبل إعادة المحاولة.", status: 409 };
    if (current?.representativeId === toRepresentativeId) return { error: "المنطقة مسندة لهذا المندوب بالفعل.", status: 409 };
    const [doctor] = await tx.select({ id: doctorsTable.id }).from(doctorsTable).where(eq(doctorsTable.region, region)).limit(1);
    if (!current && !doctor) return { error: "اختر منطقة طبيب محفوظة؛ لا يمكن إنشاء منطقة وهمية بالإسناد.", status: 400 };
    const version = expectedVersion + 1;
    await tx.insert(regionAssignmentsTable).values({ region, representativeId: toRepresentativeId, version })
      .onConflictDoUpdate({ target: regionAssignmentsTable.region, set: { representativeId: toRepresentativeId, version, updatedAt: sql`clock_timestamp()` } });
    await tx.insert(regionTransfersTable).values({ region, fromRepresentativeId, toRepresentativeId, version });
    return { assignment: await readAssignment(tx, region) };
  });
  if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
  res.json(result.assignment);
});

router.get("/handover/summary", async (req, res) => {
  const p = GetHandoverSummaryQueryParams.safeParse(req.query);
  if (!p.success) { res.status(400).json({ error: "اختر منطقة صحيحة." }); return; }
  const summary = await db.transaction((tx) => readRegionSummary(tx, p.data.region), { isolationLevel: "repeatable read", accessMode: "read only" });
  res.json(summary);
});

router.get("/handover/my-doctors", async (req, res) => {
  const session = await getDemoSession(req, "representative");
  if (!session?.representativeDirectoryId) { res.status(401).json({ error: "اختر منظور مندوب خيالي من شاشة تسليم المنطقة أولًا؛ هذا ليس تسجيل دخول حقيقيًا." }); return; }
  const summaries = await db.transaction(async (tx) => {
    const regions = await tx.select().from(regionAssignmentsTable).where(eq(regionAssignmentsTable.representativeId, session.representativeDirectoryId!)).orderBy(asc(regionAssignmentsTable.region));
    const out = [];
    for (const { region } of regions) out.push(await readRegionSummary(tx, region));
    return out;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  res.json(GetMyHandoverDoctorsResponse.parse(summaries));
});
export default router;
