import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { demoClient } from "./lib/demo-api.mjs";

const { Pool } = createRequire(new URL("../lib/db/package.json", import.meta.url))("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const api = demoClient(), ids = [], results = [];
const tables = ["doctors","products","visits","pending_visits","demo_sessions","pharmacy_observations","representatives","region_assignments","region_transfers"];
async function snapshot() {
  const result = {};
  for (const table of tables) {
    const order = table === "region_assignments" ? "region" : "id";
    result[table] = (await pool.query(`SELECT count(*)::int count,md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY ${order}),'')) fingerprint FROM ${table} t`)).rows[0];
  }
  return result;
}
function pass(label) { results.push(label); console.log(`نجح: ${label}`); }
const baseline = await snapshot();
try {
  const saved = (await pool.query("SELECT * FROM doctors ORDER BY id")).rows;
  const map = await api("/doctor-map");
  assert.equal(map.status, 200); assert.equal(map.data.length, saved.length);
  for (const d of saved) {
    const m = map.data.find(row => row.id === d.id);
    assert.equal(m.name, d.name); assert.equal(m.latitude, d.latitude); assert.equal(m.longitude, d.longitude);
    assert.equal(m.visitingStart, d.visiting_start); assert.equal(m.region, d.region);
    assert.deepEqual(Object.keys(m).sort(), ["id","name","specialty","region","clinicAddress","latitude","longitude","visitingStart","visitingEnd"].sort());
  }
  pass("إحداثيات وأسماء ومعرّفات الخريطة من السجلات الأصلية، دون بيانات إضافية أو إحداثيات مخترعة");
  const tag = `خريطة-اختبار-${Date.now()}`, region = `منطقة ${tag}`;
  const base = { name: `طبيب خيالي ${tag}`, specialty: "اختصاص خيالي", region, clinicAddress: "عنوان تقريبي خيالي",
    latitude: 33.5, longitude: 36.28, visitingStart: "09:00", visitingEnd: "15:00", scientificInterests: "اهتمام معلن خيالي" };
  for (const payload of [base, { ...base, name: `طبيب ثان ${tag}`, latitude: 33.502 }, { ...base, name: `طبيب ثالث ${tag}`, region: `أخرى ${tag}` }]) {
    const r = await api("/doctors", "POST", payload); assert.equal(r.status, 201); ids.push(r.data.id);
  }
  const reloaded = await api("/doctor-map");
  assert.equal(reloaded.data.filter(d => ids.includes(d.id)).length, 3);
  assert.equal((await api(`/doctors/${ids[0]}`)).data.name, base.name);
  pass("إضافة ملفات اختبار فقط ثم قراءتها مجددًا من الخريطة وربط الملف بمعرّفه الصحيح");
  const input = { region, startPointId: "demo-south", startTime: "09:00", visitDurationMinutes: 15, travelSpeedKmh: 25 };
  const planned = await api("/smart-route/plan", "POST", { ...input, doctorIds: ids.slice(0, 2) });
  assert.equal(planned.status, 200); assert.equal(planned.data.consideredDoctorCount, 2);
  assert.deepEqual(new Set(planned.data.stops.map(s => s.doctorId)), new Set(ids.slice(0, 2)));
  pass("مخطط Smart Route يستخدم اختيار الأطباء نفسه من قاعدة البيانات");
  const forward = await api("/smart-route/plan", "POST", { ...input, doctorIds: ids.slice(0, 2), preserveSelectionOrder: true });
  const reverse = await api("/smart-route/plan", "POST", { ...input, doctorIds: ids.slice(0, 2).reverse(), preserveSelectionOrder: true });
  assert.equal(reverse.status, 200); assert.deepEqual(reverse.data.stops.map(s => s.doctorId), ids.slice(0, 2).reverse());
  assert.notEqual(forward.data.stops[0].arrivalTime, reverse.data.stops[0].arrivalTime);
  assert.notEqual(forward.data.endTime, reverse.data.endTime);
  assert.ok(reverse.data.method.includes("يدوي"));
  pass("عكس الترتيب اليدوي يعيد حساب الوصول والمغادرة والمسافة، لا يغيّر ترقيمًا شكليًا فقط");
  const whole = await api("/smart-route/plan", "POST", input);
  assert.equal(whole.status, 200); assert.equal(whole.data.consideredDoctorCount, 2); assert.ok(whole.data.method.includes("جشع"));
  pass("طلب المنطقة السابق بلا اختيار يظل حسابًا جشعًا متوافقًا");
  for (const doctorIds of [[], [ids[0], ids[0]], [ids[0], ids[2]], [2147483647], [-1]]) {
    assert.equal((await api("/smart-route/plan", "POST", { ...input, doctorIds })).status, 400);
  }
  pass("رفض الاختيار الفارغ والمكرر والمحذوف ومنطقة أخرى والمعرّف السالب");
  assert.equal((await api("/smart-route/plan", "POST", { ...input, preserveSelectionOrder: true })).status, 400);
  assert.equal((await api("/smart-route/plan", "POST", { ...input, doctorIds: [ids[0]], preserveSelectionOrder: "true" })).status, 400);
  assert.equal((await api("/smart-route/plan", "POST", { ...input, doctorIds: [ids[0]], latitude: 0, longitude: 0 })).status, 400);
  pass("الخادم يرفض ترتيبًا بلا اختيار ونوع وضع غير صحيح وإحداثيات مزورة أو حقولًا غير معتمدة");
  const late = await api("/smart-route/plan", "POST", { ...input, doctorIds: ids.slice(0, 2), startTime: "16:00" });
  assert.equal(late.data.stops.length, 0); assert.equal(late.data.omitted.length, 2);
  assert.ok(late.data.omitted.every(d => d.reasonCode === "window_closed_at_start"));
  pass("الإغلاق يمنع الجولة ويُرجع أسباب الاستبعاد نفسها لا علامات زيارة وهمية");
  const changed = { ...base, latitude: 33.503, visitingStart: "09:30" };
  assert.equal((await api(`/doctors/${ids[0]}`, "PUT", changed)).status, 200);
  const after = (await api("/doctor-map")).data.find(d => d.id === ids[0]);
  assert.equal(after.latitude, 33.503); assert.equal(after.visitingStart, "09:30");
  const fresh = await api("/smart-route/plan", "POST", { ...input, doctorIds: [ids[0]] });
  assert.equal(fresh.data.stops[0].latitude, 33.503); assert.equal(fresh.data.stops[0].visitStartTime, "09:30");
  pass("تعديل ملف الاختبار ينعكس في قراءة الخريطة والجولة من قاعدة البيانات");
} finally {
  if (ids.length) await pool.query("DELETE FROM doctors WHERE id=ANY($1::int[])", [ids]);
  try {
    assert.deepEqual(await snapshot(), baseline);
    pass("تنظيف ملفات الاختبار وحدها وبقاء بصمات الجداول التسعة الأصلية دون أي تغيير");
    await writeFile(new URL("../generated-artifacts/doctor-map-api-results.json", import.meta.url), JSON.stringify({ passed: results.length, results }, null, 2));
  } finally { await pool.end(); }
}
console.log(`${results.length}/${results.length} فحوص API ناجحة.`);
