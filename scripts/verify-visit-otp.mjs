import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { demoClient } from "./lib/demo-api.mjs";

// Uses the existing DB dependency, no new package or test-only HTTP endpoint.
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const a = demoClient(), b = demoClient(), clinic = demoClient(), anonymous = demoClient();
const sessionIds = [], doctorIds = [], results = [];
let pending, code, productId, reportId;
const tag = `اختبار رمز خيالي ${randomUUID().slice(0, 8)}`;
const baseline = {};
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
}
async function call(client, path, method = "GET", body, status = 200) {
  const response = await client(path, method, body);
  // Do not include response bodies: clinic responses contain codes.
  assert.equal(response.status, status, `${method} ${path}: unexpected status`);
  return response.data;
}
const report = (extra = {}) => ({
  doctorId: doctorIds[0], productId, outcome: "مهتم", notes: `${tag} — ملاحظات مهنية خيالية فقط`,
  date: today, pendingVisitId: pending.id, ...extra,
});
async function start() {
  pending = await call(a, "/pending-visits", "POST", { doctorId: doctorIds[0] }, 201);
  const list = await call(clinic, `/clinic-demo/pending-visits?doctorId=${doctorIds[0]}`);
  code = list.find((item) => item.id === pending.id)?.code;
  assert.match(code, /^\d{6}$/);
}
const wrong = () => code === "000000" ? "000001" : "000000";
const verify = (client, value, expected, id = pending.id) =>
  call(client, `/pending-visits/${id}/verify`, "POST", { code: value }, expected);
const noSecrets = (value) => {
  for (const key of ["code", "otp", "otpHash", "otp_hash", "clinicEnvelope", "clinic_envelope", "token"]) {
    assert.ok(!Object.hasOwn(value, key), "Representative response exposes a secret");
  }
};

try {
  for (const path of ["/doctors", "/products", "/visits"]) baseline[path] = await call(anonymous, path);
  productId = baseline["/products"][0].id;
  for (let i = 0; i < 2; i++) {
    const doctor = await call(a, "/doctors", "POST", {
      name: `${tag} ${i}`, specialty: "اختصاص خيالي", region: "منطقة خيالية",
      clinicAddress: "عنوان اختبار خيالي", latitude: 33.5, longitude: 36.2,
      visitingStart: "09:00", visitingEnd: "12:00", scientificInterests: "موضوع علمي خيالي",
    }, 201);
    doctorIds.push(doctor.id);
  }
  await check("Anonymous clients cannot start pending visits or read clinic codes", async () => {
    await call(anonymous, "/pending-visits", "POST", { doctorId: doctorIds[0] }, 401);
    await call(anonymous, "/clinic-demo/pending-visits", "GET", undefined, 401);
  });
  await check("Separate server-issued demo sessions and HttpOnly, SameSite cookies", async () => {
    for (const [client, path] of [[a, "/verification/representative-session"], [b, "/verification/representative-session"], [clinic, "/clinic-demo/session"]]) {
      const r = await client(path, "POST");
      assert.equal(r.status, 200);
      sessionIds.push(r.data.id);
      const cookies = r.headers.getSetCookie().join(";");
      assert.match(cookies, /HttpOnly/i); assert.match(cookies, /SameSite=Strict/i);
    }
    const again = await call(a, "/verification/representative-session", "POST");
    assert.equal(again.id, sessionIds[0]);
    await call(a, "/clinic-demo/pending-visits", "GET", undefined, 401);
  });
  await check("Start binds visit, doctor and representative with a five-minute server deadline", async () => {
    await start();
    noSecrets(pending);
    assert.equal(pending.doctorId, doctorIds[0]);
    assert.equal(pending.representativeId, sessionIds[0]);
    assert.equal(pending.attemptsRemaining, 5);
    const remaining = Date.parse(pending.expiresAt) - Date.parse(pending.serverTime);
    assert.ok(remaining > 298_000 && remaining <= 300_000);
    const row = (await pool.query("SELECT otp_hash, clinic_envelope, doctor_id, representative_id FROM pending_visits WHERE id=$1", [pending.id])).rows[0];
    assert.match(row.otp_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(row.otp_hash, code);
    assert.notEqual(row.clinic_envelope, code);
    assert.equal(row.doctor_id, doctorIds[0]);
    assert.equal(row.representative_id, sessionIds[0]);
    (await call(a, "/pending-visits")).forEach(noSecrets);
  });
  await check("Unverified reports cannot be saved", async () => {
    await call(a, "/visits", "POST", report(), 403);
  });
  await check("Wrong code consumes one attempt and returns an error", async () => {
    await verify(a, wrong(), 400);
    assert.equal((await call(a, "/pending-visits"))[0].attemptsRemaining, 4);
  });
  await check("Another representative cannot verify or access this visit", async () => {
    await verify(b, code, 404);
    assert.deepEqual(await call(b, "/pending-visits"), []);
    assert.equal((await call(a, "/pending-visits"))[0].attemptsRemaining, 4);
  });
  await check("Valid code verifies once and is removed from clinic delivery", async () => {
    const verified = await verify(a, code, 200);
    assert.equal(verified.status, "confirmed"); noSecrets(verified);
    assert.ok(!(await call(clinic, "/clinic-demo/pending-visits")).some((v) => v.id === pending.id));
    const row = (await pool.query("SELECT otp_hash, clinic_envelope FROM pending_visits WHERE id=$1", [pending.id])).rows[0];
    assert.equal(row.otp_hash, null); assert.equal(row.clinic_envelope, null);
  });
  await check("Reusing an already verified code is rejected", async () => { await verify(a, code, 409); });
  await check("Report cannot switch doctor or representative, omit verification, or forge status", async () => {
    await call(a, "/visits", "POST", report({ doctorId: doctorIds[1] }), 403);
    await call(b, "/visits", "POST", report(), 403);
    const missing = report(); delete missing.pendingVisitId;
    await call(a, "/visits", "POST", missing, 400);
    await call(a, "/visits", "POST", report({ verificationStatus: "Confirmed by clinic demo code" }), 400);
  });
  await check("Verified visit saves one report with the exact server-assigned status", async () => {
    const saved = await call(a, "/visits", "POST", report(), 201);
    reportId = saved.id;
    assert.equal(saved.verificationStatus, "Confirmed by clinic demo code");
    assert.equal(saved.pendingVisitId, pending.id);
    assert.equal((await call(a, `/visits?doctorId=${doctorIds[0]}`)).find((v) => v.id === reportId).verificationStatus, saved.verificationStatus);
    await call(a, "/visits", "POST", report(), 409);
  });
  await check("Concurrent verification consumes the code exactly once", async () => {
    await start();
    const statuses = await Promise.all([a, a].map(async (client) =>
      (await client(`/pending-visits/${pending.id}/verify`, "POST", { code })).status));
    assert.deepEqual(statuses.sort(), [200, 409]);
  });
  await check("Expiry is enforced by backend even when the correct code is submitted", async () => {
    await start();
    // Controlled dev DB fixture deadline, not a client clock or production endpoint override.
    await pool.query("UPDATE pending_visits SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1 AND representative_id=$2",
      [pending.id, sessionIds[0]]);
    await verify(a, code, 410);
    assert.equal((await call(a, "/pending-visits"))[0].status, "expired");
    await call(a, "/visits", "POST", report(), 403);
    assert.ok(!(await call(clinic, "/clinic-demo/pending-visits")).some((v) => v.id === pending.id));
  });
  await check("Five failed attempts lock the visit; the valid code is then rejected", async () => {
    await start();
    for (let attempt = 1; attempt <= 5; attempt++) await verify(a, wrong(), attempt === 5 ? 429 : 400);
    await verify(a, code, 429);
    const current = (await call(a, "/pending-visits"))[0];
    assert.equal(current.status, "locked"); assert.equal(current.attemptsRemaining, 0);
    const row = (await pool.query("SELECT failed_attempts,otp_hash,clinic_envelope FROM pending_visits WHERE id=$1", [pending.id])).rows[0];
    assert.equal(row.failed_attempts, 5); assert.equal(row.otp_hash, null); assert.equal(row.clinic_envelope, null);
  });
  await check("Concurrent wrong attempts cannot exceed or bypass the five-attempt cap", async () => {
    await start();
    const badCode = wrong();
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      a(`/pending-visits/${pending.id}/verify`, "POST", { code: badCode })));
    assert.equal(responses.filter((r) => r.status === 400).length, 4);
    assert.equal(responses.filter((r) => r.status === 429).length, 4);
    assert.equal((await pool.query("SELECT failed_attempts FROM pending_visits WHERE id=$1", [pending.id])).rows[0].failed_attempts, 5);
    await verify(a, code, 429);
  });
  await check("Starting a replacement invalidates the previous exact pending visit", async () => {
    await start();
    const oldId = pending.id, oldCode = code;
    await start();
    await verify(a, oldCode, 409, oldId);
    await call(a, "/pending-visits", "POST", { doctorId: doctorIds[0], representativeId: sessionIds[1] }, 400);
  });
  await check("Existing doctor editing, search, product catalog and dashboard still work", async () => {
    const doctor = await call(a, `/doctors/${doctorIds[0]}`);
    const input = { ...doctor, clinicAddress: `${tag} عنوان معدّل` };
    delete input.id; delete input.createdAt;
    await call(a, `/doctors/${doctor.id}`, "PUT", input);
    assert.equal((await call(a, `/doctors?search=${encodeURIComponent(input.clinicAddress)}`))[0].id, doctor.id);
    assert.deepEqual(await call(a, "/products"), baseline["/products"]);
    const dashboard = await call(a, "/dashboard");
    assert.equal(dashboard.visitCount, baseline["/visits"].length + 1);
    assert.ok(dashboard.recentVisits.some((v) => v.id === reportId));
  });
  await check("Legacy reports retain an explicit unverified status, never a false confirmation", async () => {
    const legacy = (await pool.query(`INSERT INTO visits (doctor_id,product_id,outcome,notes,date)
      VALUES ($1,$2,$3,$4,$5) RETURNING id`, [doctorIds[1], productId, "متابعة لاحقة", `${tag} تقرير قديم تجريبي`, today])).rows[0];
    const view = (await call(a, `/visits?doctorId=${doctorIds[1]}`)).find((v) => v.id === legacy.id);
    assert.equal(view.verificationStatus, "Unverified legacy report");
    assert.equal(view.pendingVisitId, null);
  });
} finally {
  // Only records owned by these generated fixture doctors and sessions are removed.
  try {
    if (doctorIds.length) {
      await pool.query("DELETE FROM visits WHERE doctor_id=ANY($1::int[])", [doctorIds]);
      await pool.query("DELETE FROM pending_visits WHERE doctor_id=ANY($1::int[])", [doctorIds]);
      await pool.query("DELETE FROM doctors WHERE id=ANY($1::int[])", [doctorIds]);
    }
    if (sessionIds.length) await pool.query("DELETE FROM demo_sessions WHERE id=ANY($1::uuid[])", [sessionIds]);
    for (const path of ["/doctors", "/products", "/visits"]) {
      if (baseline[path]) assert.deepEqual(await call(anonymous, path), baseline[path], `Existing records changed: ${path}`);
    }
    results.push({ name: "Fixture cleanup preserves all prior saved records exactly", passed: true });
  } finally {
    await pool.end();
    await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
    await writeFile(new URL("../generated-artifacts/otp-test-results.json", import.meta.url), JSON.stringify({
      results, skipped: ["A literal five-minute wall-clock wait (expiry tested using a controlled past DB deadline)", "External messaging (intentionally no integration)"],
    }, null, 2));
    console.log(`${results.filter((r) => r.passed).length}/${results.length} checks passed; existing records preserved.`);
  }
}
