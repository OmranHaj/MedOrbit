import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, pharmacyObservationsTable as observations, productsTable } from "@workspace/db";
import {
  GetPharmacyComparisonQueryParams, GetPharmacyComparisonResponse,
  CreatePharmacyObservationBody, CreatePharmacyObservationResponse,
  UpdatePharmacyObservationBody, UpdatePharmacyObservationParams, UpdatePharmacyObservationResponse,
} from "@workspace/api-zod";
import { trimFields } from "../lib/validation";

const router: IRouter = Router();
router.get("/pharmacy-insights", async (req, res): Promise<void> => {
  const query = GetPharmacyComparisonQueryParams.strict().safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "اختر منتجًا محفوظًا وشهرًا صالحًا بصيغة YYYY-MM للمقارنة." }); return; }
  const { productId, period } = query.data;
  const comparison = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) return null;
    const rows = await tx.select().from(observations)
      .where(and(eq(observations.productId, productId), eq(observations.period, period)))
      .orderBy(asc(observations.region), asc(observations.id));
    return {
      productId, productName: product.name, period, observations: rows,
      observationCount: rows.length,
      totalUnits: rows.reduce((total, row) => total + row.unitsSold, 0),
      unavailableCount: rows.filter((row) => row.availability === "غير متوفر").length,
      hasSupplyConstraint: rows.some((row) => row.availability !== "متوفر"),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  if (!comparison) { res.status(404).json({ error: "المنتج غير موجود في الكتالوج الخيالي." }); return; }
  res.json(GetPharmacyComparisonResponse.parse(comparison));
});

// A closed aggregate contract: JSON only, no free notes, doctor/patient fields or files.
async function saveObservation(req: Request, res: Response): Promise<void> {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "تُقبل بيانات تجميعية بصيغة JSON فقط؛ لا تُقبل ملفات أو صور وصفات." }); return;
  }
  const updating = req.method === "PUT";
  const body = (updating ? UpdatePharmacyObservationBody : CreatePharmacyObservationBody)
    .strict().safeParse(trimFields(req.body));
  if (!body.success) {
    res.status(400).json({ error: "أدخل الحقول التجميعية الستة فقط: منتج، إقليم ومصدر خياليان، شهر صالح، وحدات صحيحة بين صفر ومليون، وحالة التوفر. تُرفض بيانات المرضى والوصفات والملفات ومعرّفات الأطباء." }); return;
  }
  const params = updating ? UpdatePharmacyObservationParams.safeParse(req.params) : undefined;
  if (params && !params.success) { res.status(400).json({ error: "معرّف الملاحظة غير صحيح." }); return; }
  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, body.data.productId));
  if (!product) { res.status(404).json({ error: "اختر منتجًا موجودًا في الكتالوج الخيالي." }); return; }
  try {
    const rows = updating && params?.success ?
      await db.update(observations).set({ ...body.data, updatedAt: sql`now()` })
        .where(eq(observations.id, params.data.id)).returning() :
      await db.insert(observations).values(body.data).returning();
    if (!rows[0]) { res.status(404).json({ error: "الملاحظة غير موجودة؛ حدّث المقارنة وحاول مجددًا." }); return; }
    res.status(updating ? 200 : 201).json(
      (updating ? UpdatePharmacyObservationResponse : CreatePharmacyObservationResponse).parse(rows[0]),
    );
  } catch (error) {
    const pg = error as { code?: string; cause?: { code?: string } };
    if ((pg.code ?? pg.cause?.code) === "23505") {
      res.status(409).json({ error: "توجد ملاحظة لهذا المنتج والإقليم والشهر. عدّل السجل الموجود بدل تكراره أو جمع مصادر متداخلة." }); return;
    }
    throw error;
  }
}
router.post("/pharmacy-insights", saveObservation);
router.put("/pharmacy-insights/:id", saveObservation);
export default router;
