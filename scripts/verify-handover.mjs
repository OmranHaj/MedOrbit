import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { demoClient } from "./lib/demo-api.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Development-only fictional verification");
const { Pool } = createRequire(new URL("../lib/db/package.json", import.meta.url))("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const read = demoClient(), a = demoClient(), b = demoClient(), clinic = demoClient();
const ids = [], sessions = [], results = [];
const region = `منطقة تسليم اختبارية ${randomUUID().slice(0, 8)}`;
const call = async (client, path, method = "GET", body, expected = 200) => {
  const r = await client(path, method, body);
  assert.equal(r.status, expected, `${method} ${path} returned ${r.status}`);
  return r.data;
};
const check = async (name, run) => {
  await run(); results.push({ name, passed: true }); console.log(`نجح: ${name}`);
};
const snapshot = async () => ({
  doctors: await call(read, "/doctors"), products: await call(read, "/products"),
  visits: await call(read, "/visits"), dashboard: await call(read, "/dashboard"),
  handover: await call(read, "/handover"),
});
const baseline = await snapshot();
const [A, B, C] = baseline.handover.representatives;
assert.ok(A && B && C, "Three fictional representatives must be seeded");
const opt = await call(read, "/smart-route/options");
const input = { region: opt.demoRegion, startPointId: opt.startPoints[0].id, startTime: "09:00" };
const previousRoute = await call(read, "/smart-route/plan", "POST", input);
const doctor = {
  name: "طبيب تسليم خيالي", specialty: "اختصاص خيالي", region,
  clinicAddress: "عنوان خيالي للتسليم", latitude: 33.5, longitude: 36.28,
  visitingStart: "09:00", visitingEnd: "15:00", scientificInterests: "مراجعة الأدلة العلمية",
};
let report, originalReport, originalDoctor;
try {
  for (const data of [doctor, { ...doctor, name: "طبيب سجل ناقص خيالي", scientificInterests: "غير مسجّل", clinicAddress: "غير مسجّل" }])
    ids.push((await call(read, "/doctors", "POST", data, 201)).id);
  const scope = `/handover/summary?region=${encodeURIComponent(region)}`;
  await check("ملخص من قاعدة البيانات: طبيبان بلا زيارات، ومعلومات ناقصة معلنة دون اختلاق", async () => {
    const s = await call(read, scope);
    assert.equal(s.doctorCount, 2); assert.equal(s.visitCount, 0);
    assert.equal(s.assignment, null);
    assert.deepEqual(s.doctors.find(d => d.doctor.id === ids[1]).missingFields.sort(), ["عنوان العيادة", "الاهتمامات العلمية"].sort());
    assert.ok(s.doctors.every(d => d.briefing.outstandingRequests.length === 0));
  });
  await check("إسناد أولي للمندوب أ مع حفظ تاريخ النسخة الأولى", async () => {
    const assignment = await call(read, "/handover/assignments", "POST", { region, fromRepresentativeId: null, toRepresentativeId: A.id, expectedVersion: 0 });
    assert.equal(assignment.version, 1); assert.equal(assignment.representativeId, A.id);
    const h = (await call(read, "/handover")).history.filter(h => h.region === region);
    assert.equal(h.length, 1); assert.equal(h[0].fromRepresentativeId, null);
  });
  for (const [client, person] of [[a, A], [b, B]]) sessions.push((await call(client, "/handover/demo-view", "POST", { representativeId: person.id })).id);
  sessions.push((await call(clinic, "/clinic-demo/session", "POST")).id);
  await check("منظور أ يرى طبيبيه، ومنظور ب لا يرى المنطقة قبل النقل", async () => {
    assert.equal((await call(a, "/handover/my-doctors")).find(s => s.region === region).doctorCount, 2);
    assert.ok(!(await call(b, "/handover/my-doctors")).some(s => s.region === region));
    await call(read, "/handover/my-doctors", "GET", undefined, 401);
  });
  const pending = await call(a, "/pending-visits", "POST", { doctorId: ids[0] }, 201);
  const deliveries = await call(clinic, `/clinic-demo/pending-visits?doctorId=${ids[0]}`);
  const code = deliveries.find(d => d.id === pending.id)?.code;
  assert.match(code, /^\d{6}$/);
  await call(a, `/pending-visits/${pending.id}/verify`, "POST", { code });
  await check("حفظ زيارة فعلية عبر OTP بهوية المؤلف أ المشتقة من جلسة الخادم", async () => {
    report = await call(a, "/visits", "POST", {
      doctorId: ids[0], productId: baseline.products[0].id, pendingVisitId: pending.id,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      outcome: "متابعة لاحقة", notes: "طلب الطبيب ملخصًا علميًا عن مراجعة الأدلة العلمية.",
    }, 201);
    assert.equal(report.authorRepresentativeId, A.id); assert.equal(report.authorName, A.name);
    originalReport = (await pool.query("SELECT to_jsonb(v) AS row FROM visits v WHERE id=$1", [report.id])).rows[0].row;
    originalDoctor = (await pool.query("SELECT to_jsonb(d) AS row FROM doctors d WHERE id=$1", [ids[0]])).rows[0].row;
  });
  await check("نقل المنطقة من أ إلى ب يغيّر الإسناد فقط", async () => {
    const saved = await call(read, "/handover/assignments", "POST", { region, fromRepresentativeId: A.id, toRepresentativeId: B.id, expectedVersion: 1 });
    assert.equal(saved.version, 2); assert.equal(saved.representativeId, B.id);
    assert.deepEqual((await pool.query("SELECT to_jsonb(v) AS row FROM visits v WHERE id=$1", [report.id])).rows[0].row, originalReport);
    assert.deepEqual((await pool.query("SELECT to_jsonb(d) AS row FROM doctors d WHERE id=$1", [ids[0]])).rows[0].row, originalDoctor);
  });
  await check("ب يرى التاريخ والاهتمامات والطلبات ومصدرها، والمؤلف يبقى أ", async () => {
    const s = (await call(b, "/handover/my-doctors")).find(s => s.region === region);
    assert.equal(s.doctorCount, 2); assert.equal(s.visitCount, 1);
    assert.equal(s.recentVisits[0].authorRepresentativeId, A.id); assert.equal(s.recentVisits[0].authorName, A.name);
    const d = s.doctors.find(d => d.doctor.id === ids[0]);
    assert.equal(d.briefing.declaredScientificInterests.text, doctor.scientificInterests);
    assert.equal(d.briefing.outstandingRequests[0].citations[0].visitId, report.id);
    assert.match(d.briefing.outstandingRequests[0].notice, /غير مسجّلة/);
    assert.ok(!(await call(a, "/handover/my-doctors")).some(s => s.region === region));
  });
  await check("طلب تحميل جديد يسترجع الإسناد ب وسجل النقل دون تكرار الأطباء", async () => {
    assert.equal((await call(read, "/handover")).assignments.find(s => s.region === region).representativeId, B.id);
    const s = await call(read, scope); assert.equal(s.assignment.representativeId, B.id);
    assert.deepEqual(s.doctors.map(d => d.doctor.id).sort((x,y)=>x-y), [...ids].sort((x,y)=>x-y));
    const h = (await call(read, "/handover")).history.filter(h => h.region === region);
    assert.equal(h.length, 2); assert.equal(h[0].fromRepresentativeId, A.id); assert.equal(h[0].toRepresentativeId, B.id);
  });
  await check("تعارض نقلين متزامنين: فائز واحد و409 للأخرى وسجل واحد", async () => {
    const responses = await Promise.all([A, C].map(to => read("/handover/assignments", "POST", { region, fromRepresentativeId: B.id, toRepresentativeId: to.id, expectedVersion: 2 })));
    assert.deepEqual(responses.map(r=>r.status).sort(), [200,409]);
    const h = (await call(read, "/handover")).history.filter(h => h.region === region);
    assert.equal(h.length, 3); assert.equal(h[0].version, 3);
  });
  await check("تبديل منظور الجلسة يصدر هوية جديدة ولا يعيد نسبة زيارة أ", async () => {
    const next = await call(a, "/handover/demo-view", "POST", { representativeId: C.id }); sessions.push(next.id);
    assert.notEqual(next.id, sessions[0]);
    assert.equal((await pool.query("SELECT representative_directory_id AS person FROM demo_sessions WHERE id=$1", [sessions[0]])).rows[0].person, A.id);
    const saved = (await call(read, `/visits?doctorId=${ids[0]}`))[0];
    assert.equal(saved.authorRepresentativeId, A.id);
    assert.equal((await call(read, "/dashboard")).recentVisits.find(v=>v.id===report.id).authorName, A.name);
  });
  await check("رفض المدخلات وهوية المؤلف المزورة والنسخ القديمة دون تغيير التاريخ", async () => {
    await call(read, "/handover/demo-view", "POST", { representativeId: 2147483647 }, 404);
    await call(read, "/handover/demo-view", "POST", { representativeId: A.id, authorName: "مزور خيالي" }, 400);
    await call(read, "/handover/assignments", "POST", { region, fromRepresentativeId: A.id, toRepresentativeId: B.id, expectedVersion: 0 }, 409);
    await call(read, "/handover/assignments", "POST", { region, fromRepresentativeId: null, toRepresentativeId: -1, expectedVersion: 0 }, 400);
    await call(b, "/visits", "POST", { doctorId: ids[0], productId: baseline.products[0].id, pendingVisitId: pending.id, date: report.date, outcome: "مهتم", notes: "ملاحظة مهنية خيالية", authorRepresentativeId: B.id }, 400);
  });
  await check("الجولة والوحدات السابقة لا تتغير بسبب الإسناد والنقل", async () => {
    assert.deepEqual(await call(read, "/smart-route/plan", "POST", input), previousRoute);
    assert.deepEqual(await call(read, "/products"), baseline.products);
  });
} finally {
  try {
    await pool.query("DELETE FROM visits WHERE doctor_id=ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM pending_visits WHERE doctor_id=ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM region_transfers WHERE region=$1", [region]);
    await pool.query("DELETE FROM region_assignments WHERE region=$1", [region]);
    await pool.query("DELETE FROM doctors WHERE id=ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM demo_sessions WHERE id=ANY($1::uuid[])", [sessions]);
    assert.deepEqual(await snapshot(), baseline);
    results.push({ name: "تنظيف سجلات الاختبار وحدها ومطابقة البيانات الأصلية", passed: true });
  } finally {
    await writeFile(new URL("../generated-artifacts/handover-results.json", import.meta.url), JSON.stringify({ results }, null, 2));
    await pool.end();
  }
}
console.log(`${results.length}/${results.length} فحص ناجح؛ حُفظت السجلات الأصلية.`);
