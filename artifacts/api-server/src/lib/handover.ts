import { db, doctorsTable, regionAssignmentsTable, representativesTable, visitsTable } from "@workspace/db";
import { asc, count, eq } from "drizzle-orm";
import { GetDoctorResponse, GetHandoverSummaryResponse, ListVisitsResponse } from "@workspace/api-zod";
import { buildDoctorBriefing, BRIEFING_REPORT_LIMIT } from "./doctor-briefing";
import { visitsQuery } from "./visit-query";

type Reader = Pick<typeof db, "select">;
function missingText(value: string) {
  const normalized = value.normalize("NFKC").replace(/[\u064B-\u065F]/g, "").trim();
  return !normalized || /^(غير\s*(مسجل|محدد|متوفر|معروف|مذكور)|لا\s*بيانات|لم\s*(يسجل|تسجل))$/.test(normalized);
}
export async function readAssignment(reader: Reader, region: string) {
  const [assignment] = await reader.select({
    region: regionAssignmentsTable.region, representativeId: regionAssignmentsTable.representativeId,
    representativeName: representativesTable.name, version: regionAssignmentsTable.version,
    updatedAt: regionAssignmentsTable.updatedAt,
  }).from(regionAssignmentsTable).innerJoin(representativesTable, eq(regionAssignmentsTable.representativeId, representativesTable.id))
    .where(eq(regionAssignmentsTable.region, region));
  return assignment ?? null;
}

export async function readRegionSummary(reader: Reader, region: string) {
  const doctors = await reader.select().from(doctorsTable).where(eq(doctorsTable.region, region)).orderBy(asc(doctorsTable.name));
  const details = [];
  let visitCount = 0;
  for (const row of doctors) {
    const doctor = GetDoctorResponse.parse(row);
    const [total] = await reader.select({ value: count() }).from(visitsTable).where(eq(visitsTable.doctorId, doctor.id));
    visitCount += total.value;
    const reports = ListVisitsResponse.parse(await visitsQuery(reader).where(eq(visitsTable.doctorId, doctor.id)).limit(BRIEFING_REPORT_LIMIT));
    const missingFields = [
      missingText(doctor.name) && "اسم الطبيب", missingText(doctor.specialty) && "الاختصاص",
      missingText(doctor.clinicAddress) && "عنوان العيادة", missingText(doctor.scientificInterests) && "الاهتمامات العلمية",
      !Number.isFinite(doctor.latitude) && "خط العرض", !Number.isFinite(doctor.longitude) && "خط الطول",
      !doctor.visitingStart && "بداية الاستقبال", !doctor.visitingEnd && "نهاية الاستقبال",
    ].filter((s): s is string => typeof s === "string");
    details.push({ doctor, briefing: buildDoctorBriefing(doctor, reports, total.value), missingFields });
  }
  const recentVisits = ListVisitsResponse.parse(await visitsQuery(reader).where(eq(doctorsTable.region, region)).limit(10));
  return GetHandoverSummaryResponse.parse({
    region, assignment: await readAssignment(reader, region), doctorCount: doctors.length, visitCount,
    doctors: details, recentVisits, reportLimit: BRIEFING_REPORT_LIMIT,
    notice: "ملخص آلي منظّم من السجلات الحالية: آخر ١٠ تقارير للمنطقة وحتى ١٠٠ تقرير لكل طبيب. الفارغ أو المكتوب صراحةً «غير مسجّل» ونظائره يُعدّ حقلًا ناقصًا. الاهتمامات مصدرها الملف؛ إنجاز الطلبات غير مسجّل. الإسناد يغيّر المسؤول الحالي فقط ولا ينقل مؤلف الزيارات. الوصول محاكاة عامة وليس حماية أدوار إنتاجية.",
  });
}
