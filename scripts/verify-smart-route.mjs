import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { demoClient } from "./lib/demo-api.mjs";

const api = demoClient();
const directory = new URL("../generated-artifacts/", import.meta.url);
const baselinePath = new URL("smart-route-baseline.json", directory);
await mkdir(directory, { recursive: true });
async function call(path, method = "GET", body, status = 200) {
  const response = await api(path, method, body);
  assert.equal(response.status, status, `${method} ${path}: unexpected status`);
  return response.data;
}
async function snapshot() {
  return {
    doctors: await call("/doctors"), products: await call("/products"), visits: await call("/visits"),
  };
}
if (process.argv.includes("--snapshot")) {
  await writeFile(baselinePath, JSON.stringify(await snapshot()));
  console.log("حُفظت لقطة مقارنة للسجلات السابقة، دون تعديلها.");
  process.exit(0);
}
const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results = [], fixtureIds = [], observed = {};
const fixtureRegion = `منطقة اختبار جولة خيالية ${randomUUID().slice(0, 8)}`;
const t = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const haversine = (a, b) => {
  const r = Math.PI / 180, dl = (b.latitude - a.latitude) * r, dn = (b.longitude - a.longitude) * r;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dn / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
};
function invariant(plan) {
  assert.equal(plan.consideredDoctorCount, plan.stops.length + plan.omitted.length);
  assert.equal(new Set([...plan.stops, ...plan.omitted].map((d) => d.doctorId)).size, plan.consideredDoctorCount);
  let position = plan.startPoint, clock = t(plan.startTime), distance = 0, travel = 0, waiting = 0;
  for (const [index, stop] of plan.stops.entries()) {
    assert.equal(stop.order, index + 1);
    const actual = haversine(position, stop);
    assert.ok(Math.abs(actual - stop.distanceKm) <= 0.00051);
    assert.equal(stop.travelMinutes, Math.ceil(actual / plan.travelSpeedKmh * 60));
    assert.equal(t(stop.arrivalTime), clock + stop.travelMinutes);
    assert.equal(t(stop.visitStartTime), Math.max(t(stop.arrivalTime), t(stop.visitingStart)));
    assert.equal(t(stop.departureTime), t(stop.visitStartTime) + plan.visitDurationMinutes);
    assert.ok(t(stop.departureTime) <= t(stop.visitingEnd));
    assert.equal(stop.waitingMinutes, t(stop.visitStartTime) - t(stop.arrivalTime));
    distance += stop.distanceKm; travel += stop.travelMinutes; waiting += stop.waitingMinutes;
    clock = t(stop.departureTime); position = stop;
  }
  assert.ok(Math.abs(plan.totalDistanceKm - distance) < 0.00001);
  assert.equal(plan.totalTravelMinutes, travel); assert.equal(plan.totalWaitingMinutes, waiting);
  assert.equal(plan.totalVisitMinutes, plan.stops.length * plan.visitDurationMinutes);
  assert.equal(plan.totalDurationMinutes, travel + waiting + plan.totalVisitMinutes);
  assert.equal(plan.totalDurationMinutes, t(plan.endTime) - t(plan.startTime));
  for (const omitted of plan.omitted) assert.ok(omitted.reason.trim().length > 10);
}
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`نجح: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
let options, input;
const plan = (extra = {}) => call("/smart-route/plan", "POST", { ...input, ...extra });
try {
  await check("تحميل المناطق المحفوظة ونقاط الانطلاق التجريبية والافتراضات", async () => {
    options = await call("/smart-route/options");
    assert.ok(options.regions.includes(options.demoRegion));
    assert.equal(options.defaultVisitDurationMinutes, 15);
    assert.ok(options.startPoints.length >= 2);
    input = { region: options.demoRegion, startPointId: options.startPoints[0].id, startTime: "09:00",
      visitDurationMinutes: 15, travelSpeedKmh: 25 };
  });
  await check("وجود ستة أطباء إضافيين بنوافذ مختلفة مع بقاء السجلات السابقة", async () => {
    const current = await snapshot(), byId = new Map(current.doctors.map((d) => [d.id, d]));
    for (const doctor of baseline.doctors) assert.deepEqual(byId.get(doctor.id), doctor);
    assert.deepEqual(current.products, baseline.products); assert.deepEqual(current.visits, baseline.visits);
    const demoDoctors = current.doctors.filter((d) => d.region === options.demoRegion);
    assert.equal(demoDoctors.length, 6);
    assert.equal(new Set(demoDoctors.map((d) => `${d.visitingStart}-${d.visitingEnd}`)).size, 6);
  });
  for (const [startTime, expected] of [["09:00", 6], ["11:30", 3], ["16:00", 0]]) {
    await check(`الانطلاق ${startTime}: ${expected} زيارات قابلة للتنفيذ وأسباب الاستبعاد واضحة`, async () => {
      const result = await plan({ startTime }); invariant(result);
      assert.equal(result.visitedDoctorCount, expected);
      assert.equal(result.omitted.length, 6 - expected);
      if (startTime === "16:00") {
        assert.ok(result.omitted.every((d) => d.reasonCode === "window_closed_at_start"));
        assert.equal(result.totalDistanceKm, 0); assert.equal(result.totalDurationMinutes, 0);
      }
      observed[startTime] = result;
    });
  }
  await check("تغيير وقت البداية يغيّر الزيارات، والانتظار محسوب منفصلًا", async () => {
    assert.notDeepEqual(observed["09:00"].stops.map((d) => d.doctorId), observed["11:30"].stops.map((d) => d.doctorId));
    assert.ok(observed["09:00"].totalWaitingMinutes > 0);
  });
  await check("السرعة المفترضة تغيّر زمن الانتقال فعليًا", async () => {
    const slow = await plan({ travelSpeedKmh: 2 }); invariant(slow);
    assert.ok(slow.totalTravelMinutes > observed["09:00"].totalTravelMinutes);
  });
  await check("مدة الزيارة الطويلة تستبعد النوافذ الأقصر منها", async () => {
    const long = await plan({ visitDurationMinutes: 60 }); invariant(long);
    assert.ok(long.omitted.some((d) => d.reasonCode === "insufficient_window"));
  });
  await check("مدخلات غير صالحة أو نقطة غير محددة مسبقًا تُرفض", async () => {
    for (const extra of [{ startTime: "25:00" }, { travelSpeedKmh: 0 }, { travelSpeedKmh: 121 },
      { visitDurationMinutes: -1 }, { visitDurationMinutes: 1.5 }, { startPointId: "unknown" },
      { region: "" }, { latitude: 1 }]) await call("/smart-route/plan", "POST", { ...input, ...extra }, 400);
  });
  await check("القيم الافتراضية تعمل على الخادم أيضًا", async () => {
    const defaults = await call("/smart-route/plan", "POST", {
      region: input.region, startPointId: input.startPointId, startTime: input.startTime,
    });
    assert.equal(defaults.visitDurationMinutes, 15); assert.equal(defaults.travelSpeedKmh, 25);
    assert.deepEqual(defaults.stops, observed["09:00"].stops);
  });
  await check("منطقة لا تحتوي أطباء تعيد نتيجة فارغة صريحة", async () => {
    const empty = await plan({ region: "منطقة خيالية غير موجودة للاختبار" });
    invariant(empty); assert.equal(empty.consideredDoctorCount, 0);
  });
  const fixture = {
    name: "طبيب حدود نافذة الجولة — شخصية خيالية", region: fixtureRegion, specialty: "اختصاص خيالي",
    clinicAddress: "عنوان خيالي للاختبار فقط", latitude: options.startPoints[0].latitude,
    longitude: options.startPoints[0].longitude, visitingStart: "09:00", visitingEnd: "09:15",
    scientificInterests: "اختبار خيالي لنهاية نافذة الاستقبال",
  };
  const saved = await call("/doctors", "POST", fixture, 201); fixtureIds.push(saved.id);
  await check("زيارة تنتهي تمامًا عند الإغلاق مسموحة ومسافة النقطة نفسها صفر", async () => {
    const boundary = await plan({ region: fixtureRegion }); invariant(boundary);
    assert.equal(boundary.visitedDoctorCount, 1);
    assert.equal(boundary.stops[0].departureTime, "09:15"); assert.equal(boundary.totalDistanceKm, 0);
  });
  await check("تعديل نافذة الطبيب في السجل المحفوظ ينعكس فورًا في التخطيط", async () => {
    await call(`/doctors/${saved.id}`, "PUT", { ...fixture, visitingEnd: "09:14" });
    const shorter = await plan({ region: fixtureRegion }); invariant(shorter);
    assert.equal(shorter.visitedDoctorCount, 0);
    assert.equal(shorter.omitted[0].reasonCode, "insufficient_window");
  });
  await check("وصول مباشر متأخر يُستبعد حتى لو كانت النافذة لم تُغلق عند الانطلاق", async () => {
    await call(`/doctors/${saved.id}`, "PUT", { ...fixture, latitude: 34.5, visitingEnd: "09:30" });
    const far = await plan({ region: fixtureRegion }); invariant(far);
    assert.equal(far.visitedDoctorCount, 0);
    assert.equal(far.omitted[0].reasonCode, "unreachable_from_start");
  });
  await check("التخطيط لا يُنشئ تقارير أو يغيّر جلسات ورموز الزيارات", async () => {
    const count = async () => (await pool.query(`SELECT (SELECT count(*) FROM visits) AS visits,
      (SELECT count(*) FROM pending_visits) AS pending,(SELECT count(*) FROM demo_sessions) AS sessions`)).rows[0];
    const before = await count();
    await plan(); await plan({ startTime: "11:30" });
    assert.deepEqual(await count(), before);
  });
} finally {
  try {
    if (fixtureIds.length) {
      const removed = await pool.query("DELETE FROM doctors WHERE id=ANY($1::int[]) AND region=$2", [fixtureIds, fixtureRegion]);
      assert.equal(removed.rowCount, fixtureIds.length);
    }
    const final = await snapshot(), byId = new Map(final.doctors.map((d) => [d.id, d]));
    for (const doctor of baseline.doctors) assert.deepEqual(byId.get(doctor.id), doctor);
    assert.deepEqual(final.products, baseline.products); assert.deepEqual(final.visits, baseline.visits);
    results.push({ name: "تنظيف طبيب الاختبار وحده وبقاء كل السجلات السابقة دون تغيير", passed: true });
  } finally {
    await pool.end();
    await writeFile(new URL("smart-route-results.json", directory), JSON.stringify({ results, observed }, null, 2));
    console.log(`${results.filter((r) => r.passed).length}/${results.length} اختبار ناجح.`);
  }
}
