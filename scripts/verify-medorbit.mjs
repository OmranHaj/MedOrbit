/**
 * Live API smoke tests, not browser/end-to-end tests.
 * Run before and after an API workflow restart. Uses fictional temporary records.
 * Afterward remove only the IDs in generated-artifacts/verification-state.json.
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { demoClient } from "./lib/demo-api.mjs";

const base = process.env.TEST_BASE_URL || "http://localhost:80/api";
const representative = demoClient(base);
const clinicDemo = demoClient(base);
const statePath = new URL("../generated-artifacts/verification-state.json", import.meta.url);
const resultsPath = new URL("../generated-artifacts/verification-results.json", import.meta.url);
await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
const afterRestart = process.argv.includes("--after-restart");
const results = afterRestart ? JSON.parse(await readFile(resultsPath, "utf8")) : [];
let state = afterRestart ? JSON.parse(await readFile(statePath, "utf8")) : {};

async function api(path, method = "GET", body, expected = 200) {
  const { status, data } = await representative(path, method, body);
  assert.equal(status, expected, `${method} ${path}: unexpected response status`);
  return data;
}
async function test(name, work) {
  try {
    await work();
    results.push({ name, passed: true });
    console.log(`نجح: ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    throw error;
  } finally {
    await writeFile(resultsPath, JSON.stringify(results, null, 2));
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }
}

if (!afterRestart) {
  state.representativeSessionId = (await api("/verification/representative-session", "POST")).id;
  state.clinicSessionId = (await clinicDemo("/clinic-demo/session", "POST")).data.id;
  await test("تحميل الأطباء والمنتجات الخيالية المحفوظة من الخادم", async () => {
    const [doctors, products, dashboard] = await Promise.all([api("/doctors"), api("/products"), api("/dashboard")]);
    assert.ok(doctors.length >= 3);
    assert.ok(products.length >= 3);
    state.productId = products[0].id;
    state.baseline = dashboard;
  });
  state.input = {
    name: "طبيب اختبار أوربت — شخصية خيالية", specialty: "اختصاص تجريبي",
    region: "منطقة الاختبار الخيالية", clinicAddress: "عنوان خيالي للاختبار فقط",
    latitude: 33.50, longitude: 36.20, visitingStart: "08:00", visitingEnd: "11:00",
    scientificInterests: "التواصل العلمي التجريبي فقط",
  };
  await test("إنشاء طبيب وحفظ جميع الحقول", async () => {
    const doctor = await api("/doctors", "POST", state.input, 201);
    state.doctorId = doctor.id;
    for (const key of Object.keys(state.input)) assert.equal(doctor[key], state.input[key]);
  });
  await test("تعديل الطبيب بما في ذلك الإحداثيات والأوقات والاهتمامات", async () => {
    state.edited = { ...state.input, name: "طبيب اختبار أوربت المعدّل — شخصية خيالية",
      specialty: "اختصاص معدّل", region: "منطقة معدّلة خيالية", clinicAddress: "عنوان معدّل خيالي",
      latitude: -12.25, longitude: 44.75, visitingStart: "14:15", visitingEnd: "17:45",
      scientificInterests: "اهتمامات مهنية تجريبية معدّلة" };
    const doctor = await api(`/doctors/${state.doctorId}`, "PUT", state.edited);
    for (const key of Object.keys(state.edited)) assert.equal(doctor[key], state.edited[key]);
  });
  await test("إعادة تحميل الملف بطلب جديد تعيد البيانات المعدّلة", async () => {
    const doctor = await api(`/doctors/${state.doctorId}`);
    for (const key of Object.keys(state.edited)) assert.equal(doctor[key], state.edited[key]);
  });
  await test("البحث باسم الطبيب والتصفية بالاختصاص والمنطقة", async () => {
    const params = new URLSearchParams({ search: "أوربت المعدّل", specialty: state.edited.specialty, region: state.edited.region });
    const doctors = await api(`/doctors?${params}`);
    assert.equal(doctors.length, 1);
    assert.equal(doctors[0].id, state.doctorId);
    assert.deepEqual(await api(`/doctors?search=${encodeURIComponent("لا توجد نتيجة بهذا الاسم")}`), []);
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await test("إنشاء تقرير زيارة بارتباط فعلي بالطبيب والمنتج", async () => {
    const pending = await api("/pending-visits", "POST", { doctorId: state.doctorId }, 201);
    state.pendingVisitId = pending.id;
    const delivery = await clinicDemo("/clinic-demo/pending-visits");
    const code = delivery.data.find((v) => v.id === pending.id).code;
    await api(`/pending-visits/${pending.id}/verify`, "POST", { code });
    state.visitInput = { doctorId: state.doctorId, productId: state.productId,
      outcome: "مهتم", notes: "ملاحظات مهنية تجريبية خيالية فقط، دون معلومات مرضى.", date: today,
      pendingVisitId: pending.id };
    const visit = await api("/visits", "POST", state.visitInput, 201);
    state.visitId = visit.id;
    for (const key of Object.keys(state.visitInput)) assert.equal(visit[key], state.visitInput[key]);
    assert.equal(visit.doctorName, state.edited.name);
  });
  await test("إعادة تحميل التقارير وملف الطبيب تظهر التقرير المحفوظ", async () => {
    const visits = await api("/visits");
    assert.ok(visits.some((v) => v.id === state.visitId && v.notes === state.visitInput.notes));
    const profileVisits = await api(`/visits?doctorId=${state.doctorId}`);
    assert.equal(profileVisits.length, 1);
    assert.equal(profileVisits[0].id, state.visitId);
  });
  await test("لوحة الشركة تُحدّث الأعداد والنتائج من السجلات الفعلية", async () => {
    const d = await api("/dashboard");
    assert.equal(d.doctorCount, state.baseline.doctorCount + 1);
    assert.equal(d.visitCount, state.baseline.visitCount + 1);
    assert.equal(d.monthVisitCount, state.baseline.monthVisitCount + 1);
    assert.equal(d.interestedCount, state.baseline.interestedCount + 1);
    assert.equal(d.visitedDoctorCount, state.baseline.visitedDoctorCount + 1);
    assert.ok(d.recentVisits.some((v) => v.id === state.visitId));
    assert.ok(d.regions.some((r) => r.label === state.edited.region && r.count === 1));
  });
  await test("رفض الإحداثيات والأوقات والنصوص غير الصالحة دون حفظ", async () => {
    await api("/doctors", "POST", { ...state.input, latitude: 91 }, 400);
    await api("/doctors", "POST", { ...state.input, visitingEnd: "07:00" }, 400);
    await api("/doctors", "POST", { ...state.input, name: "  " }, 400);
    await api(`/doctors/${state.doctorId}`, "PUT", { ...state.input, longitude: -181 }, 400);
  });
  await test("رفض التاريخ المستحيل والمستقبلي والروابط غير الموجودة", async () => {
    await api("/visits", "POST", { ...state.visitInput, date: "2026-02-30" }, 400);
    await api("/visits", "POST", { ...state.visitInput, date: "2999-01-01" }, 400);
    await api("/visits", "POST", { ...state.visitInput, doctorId: 2147483647 }, 400);
    await api("/visits", "POST", { ...state.visitInput, outcome: "قيمة غير معروفة" }, 400);
  });
  await test("رفض الحقول الإضافية غير المدعومة مثل معلومات المريض", async () => {
    await api("/visits", "POST", { ...state.visitInput, patientName: "حقل ممنوع" }, 400);
    await api("/doctors", "POST", { ...state.input, phoneNumber: "حقل غير مدعوم" }, 400);
  });
  await test("التحقق من حالات عدم وجود السجل ومعرّف غير صالح", async () => {
    await api("/doctors/2147483647", "GET", undefined, 404);
    await api("/doctors/invalid", "GET", undefined, 400);
  });
} else {
  await test("استمرار الطبيب المعدّل بعد إعادة تشغيل الخادم", async () => {
    const doctor = await api(`/doctors/${state.doctorId}`);
    for (const key of Object.keys(state.edited)) assert.equal(doctor[key], state.edited[key]);
  });
  await test("استمرار التقرير وربطه بالطبيب بعد إعادة تشغيل الخادم", async () => {
    const reports = await api(`/visits?doctorId=${state.doctorId}`);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, state.visitId);
    assert.equal(reports[0].notes, state.visitInput.notes);
    const d = await api("/dashboard");
    assert.equal(d.visitCount, state.baseline.visitCount + 1);
    assert.equal(d.doctorCount, state.baseline.doctorCount + 1);
  });
}
console.log(`النتيجة: ${results.filter((r) => r.passed).length} اختبار ناجح من ${results.length}.`);
