import { db, doctorsTable, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Fictional fixtures only. Existing edited records are never overwritten. No DDL. */
export async function seedDemoData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7019234)`);
    await tx.insert(doctorsTable).values([
      {
        demoKey: "demo-doctor-1", name: "د. سليم المدار — شخصية خيالية", specialty: "أمراض القلب",
        region: "منطقة النور", clinicAddress: "مدينة أوربت الخيالية، شارع النور، بناء ١",
        latitude: 33.51, longitude: 36.29, visitingStart: "09:00", visitingEnd: "12:00",
        scientificInterests: "التثقيف العلمي في صحة القلب والوقاية؛ بيانات تجريبية لا تمثل طبيبًا حقيقيًا.",
      },
      {
        demoKey: "demo-doctor-2", name: "د. لينا الأفق — شخصية خيالية", specialty: "الأمراض الجلدية",
        region: "منطقة الأفق", clinicAddress: "مدينة أوربت الخيالية، ساحة الأفق، بناء ٢",
        latitude: 33.52, longitude: 36.30, visitingStart: "13:00", visitingEnd: "16:00",
        scientificInterests: "أبحاث الحاجز الجلدي والتواصل العلمي؛ بيانات تجريبية لا تمثل طبيبة حقيقية.",
      },
      {
        demoKey: "demo-doctor-3", name: "د. مازن السحاب — شخصية خيالية", specialty: "الطب الداخلي",
        region: "منطقة السحاب", clinicAddress: "مدينة أوربت الخيالية، شارع السحاب، بناء ٣",
        latitude: 33.53, longitude: 36.31, visitingStart: "10:00", visitingEnd: "14:00",
        scientificInterests: "مراجعة الأدلة العلمية والتثقيف المهني؛ بيانات تجريبية لا تمثل طبيبًا حقيقيًا.",
      },
    ]).onConflictDoNothing({ target: doctorsTable.demoKey });
    await tx.insert(productsTable).values([
      {
        demoKey: "demo-product-1", name: "أوربيتال — منتج خيالي", category: "التثقيف بصحة القلب",
        description: "منتج افتراضي لعرض سير الزيارة فقط؛ غير متاح للبيع ولا يحمل أي ادعاء علاجي.",
        scientificTopic: "مناقشة التواصل العلمي في مجال صحة القلب دون توصيات علاجية.",
      },
      {
        demoKey: "demo-product-2", name: "ديرما أفق — منتج خيالي", category: "التثقيف بصحة الجلد",
        description: "منتج افتراضي لأغراض الهاكاثون، وليس دواءً أو وصفة أو توصية طبية.",
        scientificTopic: "مناقشة مبادئ مراجعة الأدلة في الأبحاث الجلدية.",
      },
      {
        demoKey: "demo-product-3", name: "فيتا مدار — منتج خيالي", category: "التثقيف العلمي العام",
        description: "منتج تجريبي خيالي لتوضيح توثيق الزيارات المهنية فقط؛ لا يُستخدم طبيًا.",
        scientificTopic: "أساسيات تقديم المعلومات العلمية وتوثيق الأسئلة المهنية.",
      },
    ]).onConflictDoNothing({ target: productsTable.demoKey });
  });
}
