import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, doctorsTable, productsTable, visitsTable } from "@workspace/db";
import { CreateVisitBody, CreateVisitResponse, ListVisitsQueryParams, ListVisitsResponse } from "@workspace/api-zod";
import { trimFields, validVisitDate } from "../lib/validation";
import { visitsQuery } from "../lib/visit-query";

const router: IRouter = Router();
router.get("/visits", async (req, res): Promise<void> => {
  const parsed = ListVisitsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "معرّف الطبيب غير صحيح." }); return; }
  res.json(ListVisitsResponse.parse(await visitsQuery().where(
    parsed.data.doctorId ? eq(visitsTable.doctorId, parsed.data.doctorId) : undefined,
  )));
});

router.post("/visits", async (req, res): Promise<void> => {
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
  const [saved] = await db.insert(visitsTable).values(parsed.data).returning({ id: visitsTable.id });
  const [visit] = await visitsQuery().where(eq(visitsTable.id, saved.id));
  res.status(201).json(CreateVisitResponse.parse(visit));
});
export default router;
