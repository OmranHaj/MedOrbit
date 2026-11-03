import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { demoClient } from "./lib/demo-api.mjs";

const rep = demoClient(), clinic = demoClient(), read = demoClient();
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const doctorIds = [], sessionIds = [], results = [], savedReports = [];
const tag = `تحضير خيالي ${randomUUID().slice(0, 8)}`;
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function call(client, path, method = "GET", body, expected = 200) {
  const r = await client(path, method, body);
  assert.equal(r.status, expected, `${method} ${path}: unexpected status`);
  return r.data;
}
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`نجح: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
const snapshot = async () => ({
  doctors: await call(read, "/doctors"), products: await call(read, "/products"), visits: await call(read, "/visits"),
});
const baseline = await snapshot();
const options = await call(read, "/smart-route/options");
const routeInput = { region: options.demoRegion, startPointId: options.startPoints[0].id, startTime: "09:00" };
const previousRoute = await call(read, "/smart-route/plan", "POST", routeInput);
const doctorInput = {
  name: `${tag} — شخصية خيالية`, specialty: "اختصاص خيالي", region: "منطقة اختبار التحضير الخيالية",
  clinicAddress: "عنوان خيالي للاختبار", latitude: 33.5, longitude: 36.28,
  visitingStart: "09:00", visitingEnd: "15:00", scientificInterests: "مراجعة الأدلة العلمية",
};
let before, after;
async function saveVisit(doctorId, extra = {}) {
  const pending = await call(rep, "/pending-visits", "POST", { doctorId }, 201);
  const deliveries = await call(clinic, "/clinic-demo/pending-visits");
  const code = deliveries.find((item) => item.id === pending.id)?.code;
  assert.match(code, /^\d{6}$/);
  await call(rep, `/pending-visits/${pending.id}/verify`, "POST", { code });
  const report = await call(rep, "/visits", "POST", {
    doctorId, productId: baseline.products[0].id, date, pendingVisitId: pending.id,
    outcome: "متابعة لاحقة", notes: "طلب الطبيب ملخصًا علميًا عن مراجعة الأدلة العلمية. ناقشنا مراجعة الأدلة العلمية فقط.",
    ...extra,
  }, 201);
  savedReports.push(report);
  return report;
}
function verifySources(brief) {
  const ownReports = new Map(savedReports.filter((r) => r.doctorId === brief.doctorId).map((r) => [r.id, r]));
  const citations = [
    ...brief.timeline.map((item) => item.citation),
    ...brief.productsDiscussed.flatMap((item) => item.citations),
    ...brief.outstandingRequests.flatMap((item) => item.citations),
    ...brief.suggestedFollowUp.flatMap((item) => item.citations),
    ...brief.declaredScientificInterests.visitCitations,
  ];
  for (const c of citations) {
    const source = ownReports.get(c.visitId);
    assert.ok(source, "A citation must belong to this doctor's actual report");
    assert.equal(c.date, source.date);
    assert.equal(c.verificationStatus, source.verificationStatus);
    assert.ok(source.notes.includes(c.excerpt));
  }
  for (const item of [...brief.productsDiscussed, ...brief.outstandingRequests, ...brief.suggestedFollowUp]) assert.ok(item.citations.length > 0);
}
try {
  for (const suffix of ["", " آخر"]) doctorIds.push((await call(rep, "/doctors", "POST", { ...doctorInput, name: `${doctorInput.name}${suffix}` }, 201)).id);
  sessionIds.push((await call(rep, "/verification/representative-session", "POST")).id);
  sessionIds.push((await call(clinic, "/clinic-demo/session", "POST")).id);
  const path = `/doctors/${doctorIds[0]}/briefing`;
  await check("قبل إنشاء زيارة: لا خط زمني أو منتجات أو طلبات أو متابعة مختلقة", async () => {
    before = await call(read, path);
    assert.equal(before.label, "ملخص آلي منظّم"); assert.equal(before.generativeAiUsed, false);
    assert.equal(before.totalVisitCount, 0);
    for (const list of [before.timeline, before.productsDiscussed, before.outstandingRequests, before.suggestedFollowUp]) assert.deepEqual(list, []);
    assert.equal(before.declaredScientificInterests.sourceField, "scientificInterests");
    assert.deepEqual(before.declaredScientificInterests.visitCitations, []);
  });
  const saved = await saveVisit(doctorIds[0]);
  await check("بعد إنشاء تقرير فعلي عبر OTP: تحديث كل الأقسام من قاعدة البيانات", async () => {
    after = await call(read, path);
    assert.equal(after.totalVisitCount, 1); assert.equal(after.timeline[0].visitId, saved.id);
    assert.equal(after.productsDiscussed[0].productId, saved.productId);
    assert.equal(after.outstandingRequests.length, 1);
    assert.equal(after.outstandingRequests[0].state, "untracked");
    assert.ok(saved.notes.includes(after.outstandingRequests[0].quote));
    assert.ok(after.suggestedFollowUp.length > 0);
    assert.equal(after.declaredScientificInterests.visitCitations[0].visitId, saved.id);
    verifySources(after);
  });
  await check("إعادة تحميل الملخص تسترجع التقرير وتاريخه وحالته الحقيقية", async () => {
    const again = await call(read, path);
    assert.deepEqual(again.timeline, after.timeline);
    verifySources(again);
  });
  await check("تقارير طبيب آخر لا تتسرّب إلى الملخص", async () => {
    await saveVisit(doctorIds[1], { notes: "نقاش مهني خيالي منفصل عن الطبيب الأول." });
    const own = await call(read, path);
    assert.equal(own.totalVisitCount, 1); verifySources(own);
  });
  await check("تقرير لم تتم الزيارة يبقى في التاريخ ولا يتحول إلى نقاش منتج أو طلب فعلي", async () => {
    const cancelled = await saveVisit(doctorIds[0], {
      outcome: "لم تتم الزيارة", productId: baseline.products[1].id,
      notes: "لم تتم الزيارة. طلب الطبيب ملخصًا في ملاحظة اختبار متناقضة لا يعتمدها الملخص.",
    });
    const current = await call(read, path);
    assert.equal(current.totalVisitCount, 2); assert.equal(current.timeline[0].visitId, cancelled.id);
    assert.equal(current.productsDiscussed.length, 1);
    assert.ok(current.productsDiscussed.every((p) => p.productId !== cancelled.productId));
    assert.ok(current.outstandingRequests.every((r) => r.citations[0].visitId !== cancelled.id));
    assert.match(current.suggestedFollowUp.at(-1).text, /تنسيق وقت/);
    verifySources(current);
  });
  await check("تعديل الاهتمامات في الملف لا يُنسب إلى زيارة لا تذكرها", async () => {
    await call(rep, `/doctors/${doctorIds[0]}`, "PUT", { ...doctorInput, scientificInterests: "التثقيف العلمي المنهجي" });
    const current = await call(read, path);
    assert.equal(current.declaredScientificInterests.text, "التثقيف العلمي المنهجي");
    assert.deepEqual(current.declaredScientificInterests.visitCitations, []);
  });
  await check("حالات المعرّف الخاطئ والطبيب غير الموجود صريحة", async () => {
    await call(read, "/doctors/invalid/briefing", "GET", undefined, 400);
    await call(read, "/doctors/2147483647/briefing", "GET", undefined, 404);
  });
  await check("طلب التحضير للقراءة فقط والجولة السابقة لا تتغيّر", async () => {
    const counts = async () => (await pool.query(`SELECT (SELECT count(*) FROM visits) AS visits,
      (SELECT count(*) FROM pending_visits) AS pending,(SELECT count(*) FROM demo_sessions) AS sessions`)).rows[0];
    const prior = await counts();
    await call(read, path); await call(read, path);
    assert.deepEqual(await counts(), prior);
    assert.deepEqual(await call(read, "/smart-route/plan", "POST", routeInput), previousRoute);
  });
} finally {
  try {
    if (doctorIds.length) {
      await pool.query("DELETE FROM visits WHERE doctor_id=ANY($1::int[])", [doctorIds]);
      await pool.query("DELETE FROM pending_visits WHERE doctor_id=ANY($1::int[])", [doctorIds]);
      const deleted = await pool.query("DELETE FROM doctors WHERE id=ANY($1::int[]) AND region=$2", [doctorIds, doctorInput.region]);
      assert.equal(deleted.rowCount, doctorIds.length);
    }
    if (sessionIds.length) await pool.query("DELETE FROM demo_sessions WHERE id=ANY($1::uuid[])", [sessionIds]);
    assert.deepEqual(await snapshot(), baseline);
    results.push({ name: "تنظيف بيانات الاختبار وحدها والحفاظ على السجلات السابقة كاملة", passed: true });
  } finally {
    await pool.end();
    await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
    await writeFile(new URL("../generated-artifacts/briefing-results.json", import.meta.url), JSON.stringify({ results, before, after }, null, 2));
    console.log(`${results.filter((r) => r.passed).length}/${results.length} اختبار ناجح.`);
  }
}
