import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, doctorsTable } from "@workspace/db";
import {
  ListDoctorsQueryParams, ListDoctorsResponse, CreateDoctorBody, CreateDoctorResponse,
  GetDoctorParams, GetDoctorResponse, UpdateDoctorParams, UpdateDoctorBody, UpdateDoctorResponse,
} from "@workspace/api-zod";
import { trimFields } from "../lib/validation";

const router: IRouter = Router();

router.get("/doctors", async (req, res): Promise<void> => {
  const parsed = ListDoctorsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "معايير البحث غير صحيحة." }); return; }
  const { search, specialty, region } = parsed.data;
  // Escape LIKE wildcards so a user's search stays literal.
  const literal = search?.trim().replace(/[\\%_]/g, "\\$&");
  const rows = await db.select().from(doctorsTable).where(and(
    literal ? or(ilike(doctorsTable.name, `%${literal}%`), ilike(doctorsTable.specialty, `%${literal}%`),
      ilike(doctorsTable.region, `%${literal}%`), ilike(doctorsTable.clinicAddress, `%${literal}%`),
      ilike(doctorsTable.scientificInterests, `%${literal}%`)) : undefined,
    specialty ? eq(doctorsTable.specialty, specialty) : undefined,
    region ? eq(doctorsTable.region, region) : undefined,
  )).orderBy(desc(doctorsTable.id));
  res.json(ListDoctorsResponse.parse(rows));
});

router.post("/doctors", async (req, res): Promise<void> => {
  const parsed = CreateDoctorBody.strict().safeParse(trimFields(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: "يرجى استكمال الحقول والتحقق من أطوال النصوص والإحداثيات والأوقات." }); return;
  }
  if (parsed.data.visitingStart >= parsed.data.visitingEnd) {
    res.status(400).json({ error: "يجب أن يكون وقت نهاية استقبال المندوبين بعد وقت البداية." }); return;
  }
  const [doctor] = await db.insert(doctorsTable).values(parsed.data).returning();
  res.status(201).json(CreateDoctorResponse.parse(doctor));
});

router.get("/doctors/:id", async (req, res): Promise<void> => {
  const params = GetDoctorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "معرّف الطبيب غير صحيح." }); return; }
  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, params.data.id));
  if (!doctor) { res.status(404).json({ error: "لم يتم العثور على ملف الطبيب." }); return; }
  res.json(GetDoctorResponse.parse(doctor));
});

router.put("/doctors/:id", async (req, res): Promise<void> => {
  const params = UpdateDoctorParams.safeParse(req.params);
  const parsed = UpdateDoctorBody.strict().safeParse(trimFields(req.body));
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "تعذر الحفظ؛ تحقق من جميع الحقول والإحداثيات والأوقات." }); return;
  }
  if (parsed.data.visitingStart >= parsed.data.visitingEnd) {
    res.status(400).json({ error: "يجب أن يكون وقت نهاية استقبال المندوبين بعد وقت البداية." }); return;
  }
  const [doctor] = await db.update(doctorsTable).set(parsed.data).where(eq(doctorsTable.id, params.data.id)).returning();
  if (!doctor) { res.status(404).json({ error: "لم يتم العثور على ملف الطبيب." }); return; }
  res.json(UpdateDoctorResponse.parse(doctor));
});

export default router;
