import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { demoClient } from "./lib/demo-api.mjs";

// Development DB only. Own IDs are cleaned up; never restore or overwrite other rows.
const request = demoClient();
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ids = [], results = [];
async function call(path, method = "GET", body, expected = 200) {
  const r = await request(path, method, body);
  assert.equal(r.status, expected, `${method} ${path}: unexpected HTTP status`);
  return r.data;
}
async function check(name, action) {
  try { await action(); results.push({ name, passed: true }); console.log(`نجح: ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); throw e; }
}
const snapshot = async () => ({
  doctors: await call("/doctors"), products: await call("/products"), visits: await call("/visits"),
  observations: (await pool.query("SELECT * FROM pharmacy_observations ORDER BY id")).rows,
});
const baseline = await snapshot();
assert.ok(baseline.products.length >= 2);
const dashboardBefore = await call("/dashboard");
const options = await call("/smart-route/options");
const routeBodies = ["09:00", "11:30", "16:00"].map((startTime) => ({
  region: options.demoRegion, startPointId: options.startPoints[0].id, startTime,
}));
const routesBefore = await Promise.all(routeBodies.map((body) => call("/smart-route/plan", "POST", body)));
const usedPeriods = new Set(baseline.observations.map((row) => row.period));
const free = [];
for (let year = 2080; year <= 2099 && free.length < 2; year++) for (let month = 1; month <= 12 && free.length < 2; month++) {
  const value = `${year}-${String(month).padStart(2, "0")}`;
  if (!usedPeriods.has(value)) free.push(value);
}
assert.equal(free.length, 2);
const [period, otherPeriod] = free;
const initial = {
  productId: baseline.products[0].id, region: "الإقليم التجريبي أ", period,
  unitsSold: 12, availability: "غير متوفر", sourceLabel: "تجميع خيالي أ",
};
const edited = { ...initial, unitsSold: 37, availability: "متوفر", sourceLabel: "تجميع خيالي ب" };
const compare = (productId = initial.productId, month = period) =>
  call(`/pharmacy-insights?productId=${productId}&period=${month}`);
const create = async (body) => { const row = await call("/pharmacy-insights", "POST", body, 201); ids.push(row.id); return row; };
let first, second, beforeEdit, afterEdit;
try {
  await check("مقارنة فارغة: لا صفوف أو مبيعات افتراضية للمناطق الغائبة", async () => {
    const data = await compare();
    assert.deepEqual(data.observations, []); assert.equal(data.totalUnits, 0);
    assert.equal(data.observationCount, 0); assert.equal(data.hasSupplyConstraint, false);
  });
  await check("إضافة 12 وحدة غير متوفرة تحدّث المقارنة ولوحة الشركة من قاعدة البيانات", async () => {
    first = await create(initial);
    beforeEdit = await compare();
    assert.equal(beforeEdit.observationCount, 1); assert.equal(beforeEdit.totalUnits, 12);
    assert.equal(beforeEdit.hasSupplyConstraint, true); assert.equal(beforeEdit.unavailableCount, 1);
    const d = await call("/dashboard");
    assert.equal(d.pharmacyObservationCount, dashboardBefore.pharmacyObservationCount + 1);
    assert.equal(d.pharmacyUnavailableCount, dashboardBefore.pharmacyUnavailableCount + 1);
    const row = (await pool.query("SELECT * FROM pharmacy_observations WHERE id=$1", [first.id])).rows[0];
    assert.equal(row.units_sold, 12); assert.equal(row.product_id, initial.productId);
  });
  await check("تعديل الملاحظة إلى 37 وحدة متوفرة وتغيير المصدر يظهر بعد طلب جديد", async () => {
    const saved = await call(`/pharmacy-insights/${first.id}`, "PUT", edited);
    assert.equal(saved.id, first.id); assert.equal(saved.createdAt, first.createdAt);
    assert.ok(new Date(saved.updatedAt) >= new Date(first.updatedAt));
    afterEdit = await compare();
    assert.equal(afterEdit.totalUnits, 37); assert.equal(afterEdit.observations[0].sourceLabel, edited.sourceLabel);
    assert.equal(afterEdit.unavailableCount, 0); assert.equal(afterEdit.hasSupplyConstraint, false);
    const d = await call("/dashboard");
    assert.equal(d.pharmacyObservationCount, dashboardBefore.pharmacyObservationCount + 1);
    assert.equal(d.pharmacyUnavailableCount, dashboardBefore.pharmacyUnavailableCount);
    assert.equal((await pool.query("SELECT units_sold FROM pharmacy_observations WHERE id=$1", [first.id])).rows[0].units_sold, 37);
  });
  await check("مقارنة مناطق المنتج والشهر نفسيهما تميّز صفرًا محفوظًا من البيانات الغائبة", async () => {
    second = await create({ ...edited, region: "الإقليم التجريبي ب", unitsSold: 9, availability: "محدود" });
    await create({ ...edited, region: "الإقليم التجريبي ج", unitsSold: 0 });
    const data = await compare();
    assert.equal(data.observationCount, 3); assert.equal(data.totalUnits, 46);
    assert.equal(data.hasSupplyConstraint, true);
    assert.equal(data.observations.find((o) => o.region === "الإقليم التجريبي ج").unitsSold, 0);
  });
  await check("لا تختلط مبيعات منتج آخر أو شهر آخر بالقيم المعروضة", async () => {
    await create({ ...edited, productId: baseline.products[1].id, unitsSold: 333 });
    await create({ ...edited, region: "الإقليم التجريبي ب", period: otherPeriod, unitsSold: 222 });
    const data = await compare();
    assert.equal(data.totalUnits, 46);
    assert.ok(data.observations.every((o) => o.productId === initial.productId && o.period === period));
    assert.equal((await compare(baseline.products[1].id)).totalUnits, 333);
    assert.equal((await compare(initial.productId, otherPeriod)).totalUnits, 222);
  });
  await check("تغيير شهر الملاحظة ينقلها بين نطاقي المقارنة دون نسخ أو فقد", async () => {
    await call(`/pharmacy-insights/${first.id}`, "PUT", { ...edited, period: otherPeriod });
    assert.equal((await compare()).totalUnits, 9);
    assert.equal((await compare(initial.productId, otherPeriod)).totalUnits, 259);
    await call(`/pharmacy-insights/${first.id}`, "PUT", edited);
    assert.equal((await compare()).totalUnits, 46);
  });
  await check("منع تكرار المنتج والإقليم والشهر، حتى مع اختلاف المصدر، دون كتابة فوق السجل", async () => {
    const prior = await compare();
    await call("/pharmacy-insights", "POST", { ...edited, unitsSold: 999 }, 409);
    await call(`/pharmacy-insights/${second.id}`, "PUT", { ...edited, unitsSold: 888 }, 409);
    assert.deepEqual(await compare(), prior);
  });
  await check("التحقق من الوحدات الصحيحة وحدودها والفترة والخيارات الخيالية", async () => {
    for (const invalid of [
      { unitsSold: -1 }, { unitsSold: 1.5 }, { unitsSold: 1000001 }, { unitsSold: "12" }, { unitsSold: null },
      { period: "2080-13" }, { period: "2080-1" }, { region: "منطقة غير مسموحة" },
      { sourceLabel: "نص حر غير مسموح" }, { availability: "غير معروف" }, { productId: 1e20 },
    ]) await call("/pharmacy-insights", "POST", { ...edited, ...invalid }, 400);
    await call("/pharmacy-insights", "POST", { ...edited, productId: 2147483647 }, 404);
    await call("/pharmacy-insights?productId=1&period=2080-13", "GET", undefined, 400);
    await call("/pharmacy-insights?productId=1e20&period=2080-01", "GET", undefined, 400);
    await call(`/pharmacy-insights/not-an-id`, "PUT", edited, 400);
    await call(`/pharmacy-insights/2147483647`, "PUT", edited, 404);
  });
  await check("رفض حقول المرضى والوصفات والصور ومعرّف الطبيب وتقييمه قبل التخزين", async () => {
    for (const key of ["patientDetails", "prescription", "prescriptionPhoto", "doctorId", "doctorScore", "notes"]) {
      await call("/pharmacy-insights", "POST", { ...edited, [key]: "حقل اختبار مرفوض، بلا بيانات شخصية" }, 400);
      await call(`/pharmacy-insights/${first.id}`, "PUT", { ...edited, [key]: "مرفوض" }, 400);
    }
    const data = await compare();
    assert.equal(data.totalUnits, 46);
    for (const row of data.observations) assert.deepEqual(Object.keys(row).sort(),
      ["id", "productId", "region", "period", "unitsSold", "availability", "sourceLabel", "createdAt", "updatedAt"].sort());
  });
  await check("رفض رفع الملفات وطلبات غير JSON", async () => {
    const form = new FormData(); form.set("prescriptionPhoto", new Blob(["not-a-prescription"]), "blocked.txt");
    for (const [url, method] of [["/pharmacy-insights", "POST"], [`/pharmacy-insights/${first.id}`, "PUT"]]) {
      const r = await fetch(`http://localhost:80/api${url}`, { method, body: form });
      assert.equal(r.status, 415);
    }
  });
  await check("تعديل سجل الاختبار مباشرة في قاعدة التطوير يغيّر قراءات اللوحتين، وليست أرقامًا ثابتة", async () => {
    await pool.query("UPDATE pharmacy_observations SET units_sold=41,availability='غير متوفر' WHERE id=$1", [first.id]);
    assert.equal((await compare()).totalUnits, 50);
    assert.equal((await call("/dashboard")).pharmacyUnavailableCount, dashboardBefore.pharmacyUnavailableCount + 1);
    await call(`/pharmacy-insights/${first.id}`, "PUT", edited);
    assert.equal((await compare()).totalUnits, 46);
  });
  await check("الجولة في ثلاثة أوقات وحقول لوحة الزيارات السابقة لا تتأثر بملاحظات الصيدليات", async () => {
    const now = await call("/dashboard");
    const { pharmacyObservationCount: _a, pharmacyUnavailableCount: _b, ...visitsNow } = now;
    const { pharmacyObservationCount: _c, pharmacyUnavailableCount: _d, ...visitsBefore } = dashboardBefore;
    assert.deepEqual(visitsNow, visitsBefore);
    assert.deepEqual(await Promise.all(routeBodies.map((body) => call("/smart-route/plan", "POST", body))), routesBefore);
  });
} finally {
  try {
    if (ids.length) await pool.query("DELETE FROM pharmacy_observations WHERE id=ANY($1::int[])", [ids]);
    assert.deepEqual(await snapshot(), baseline);
    assert.deepEqual(await call("/dashboard"), dashboardBefore);
    results.push({ name: "تنظيف بيانات الاختبار وحدها وبقاء جميع السجلات السابقة كما كانت", passed: true });
  } finally {
    await pool.end();
    await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
    await writeFile(new URL("../generated-artifacts/pharmacy-results.json", import.meta.url), JSON.stringify({ results, beforeEdit, afterEdit }, null, 2));
    console.log(`${results.filter((r) => r.passed).length}/${results.length} فحص ناجح.`);
  }
}
