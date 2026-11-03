import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, doctorsTable } from "@workspace/db";
import { GetSmartRouteOptionsResponse, PlanSmartRouteBody, PlanSmartRouteResponse } from "@workspace/api-zod";
import { calculateSmartRoute, DEMO_START_POINTS, MAX_ROUTE_DOCTORS, routeOptions } from "../lib/smart-route";
import { trimFields } from "../lib/validation";

const router: IRouter = Router();
router.get("/smart-route/options", async (_req, res): Promise<void> => {
  const rows = await db.selectDistinct({ region: doctorsTable.region }).from(doctorsTable).orderBy(asc(doctorsTable.region));
  res.json(GetSmartRouteOptionsResponse.parse(routeOptions(rows.map((row) => row.region))));
});
router.post("/smart-route/plan", async (req, res): Promise<void> => {
  const parsed = PlanSmartRouteBody.strict().safeParse(trimFields(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: "اختر المنطقة ونقطة البداية ووقتًا صحيحًا؛ مدة الزيارة عدد صحيح من 1 إلى 120 دقيقة، والسرعة من 1 إلى 120 كم/ساعة." }); return;
  }
  const startPoint = DEMO_START_POINTS.find((point) => point.id === parsed.data.startPointId);
  if (!startPoint) { res.status(400).json({ error: "اختر نقطة انطلاق من النقاط التجريبية المحددة مسبقًا." }); return; }
  const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.region, parsed.data.region))
    .orderBy(asc(doctorsTable.id)).limit(MAX_ROUTE_DOCTORS + 1);
  if (doctors.length > MAX_ROUTE_DOCTORS) {
    res.status(400).json({ error: `تدعم هذه النسخة التجريبية حتى ${MAX_ROUTE_DOCTORS} طبيب في المنطقة الواحدة. لم تُستبعد سجلات بصمت؛ اختر منطقة أصغر.` }); return;
  }
  res.json(PlanSmartRouteResponse.parse(calculateSmartRoute(parsed.data, startPoint, doctors)));
});
export default router;
