import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import { db, doctorsTable, productsTable, visitsTable } from "@workspace/db";
import { GetDoctorBriefingParams, GetDoctorBriefingResponse, GetDoctorResponse, ListVisitsResponse } from "@workspace/api-zod";
import { BRIEFING_REPORT_LIMIT, buildDoctorBriefing } from "../lib/doctor-briefing";
import { visitFields } from "../lib/visit-query";

const router: IRouter = Router();
router.get("/doctors/:id/briefing", async (req, res): Promise<void> => {
  const params = GetDoctorBriefingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "معرّف الطبيب غير صحيح." }); return; }
  const briefing = await db.transaction(async (tx) => {
    const [doctor] = await tx.select().from(doctorsTable).where(eq(doctorsTable.id, params.data.id));
    if (!doctor) return null;
    const [total] = await tx.select({ value: count() }).from(visitsTable).where(eq(visitsTable.doctorId, doctor.id));
    const reports = await tx.select(visitFields).from(visitsTable)
      .innerJoin(doctorsTable, eq(doctorsTable.id, visitsTable.doctorId))
      .innerJoin(productsTable, eq(productsTable.id, visitsTable.productId))
      .where(eq(visitsTable.doctorId, doctor.id))
      .orderBy(desc(visitsTable.date), desc(visitsTable.id)).limit(BRIEFING_REPORT_LIMIT);
    return buildDoctorBriefing(GetDoctorResponse.parse(doctor), ListVisitsResponse.parse(reports), total.value);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  if (!briefing) { res.status(404).json({ error: "لم يتم العثور على ملف الطبيب." }); return; }
  res.json(GetDoctorBriefingResponse.parse(briefing));
});
export default router;
