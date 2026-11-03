import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, doctorsTable } from "@workspace/db";
import { GetDoctorMapResponse } from "@workspace/api-zod";
import { mapDoctor } from "../lib/doctor-map";

const router: IRouter = Router();

router.get("/doctor-map", async (_req, res): Promise<void> => {
  const doctors = await db.select().from(doctorsTable).orderBy(asc(doctorsTable.id));
  res.json(GetDoctorMapResponse.parse(doctors.map(mapDoctor)));
});
export default router;
