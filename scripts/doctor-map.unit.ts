import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDoctor } from "../artifacts/api-server/src/lib/doctor-map";
import { calculateSmartRoute, DEMO_START_POINTS } from "../artifacts/api-server/src/lib/smart-route";
import type { DoctorRecord } from "../lib/db/src/schema/doctors";

// In-memory fictional edge cases. No DB schema constraints are dropped for a test.
const doctor = {
  id: 1, name: "طبيب اختبار خيالي", specialty: "اختصاص خيالي", region: "منطقة اختبار خيالية",
  clinicAddress: "عنوان خيالي", latitude: 33.5, longitude: 36.28,
  visitingStart: "09:00", visitingEnd: "15:00", scientificInterests: "اهتمام معلن",
  demoKey: null, createdAt: "2026-11-03T00:00:00Z",
} satisfies DoctorRecord;
test("Saved fields preserved; unrelated fields not exposed on map", () => {
  const d = mapDoctor(doctor);
  assert.equal(d.latitude, doctor.latitude); assert.equal(d.visitingStart, doctor.visitingStart);
  assert.equal(d.id, doctor.id); assert.equal(d.name, doctor.name);
  assert.deepEqual(Object.keys(d).sort(), ["id","name","specialty","region","clinicAddress","latitude","longitude","visitingStart","visitingEnd"].sort());
});
for (const value of [null, undefined, NaN, Infinity, -Infinity, 91, -91, "33.5"]) {
  test(`Unusable latitude ${String(value)} never becomes invented coordinates`, () => {
    const d = mapDoctor({ ...doctor, latitude: value } as DoctorRecord);
    assert.equal(d.latitude, null); assert.equal(d.longitude, null);
  });
}
test("Invalid longitude and missing hours are independent", () => {
  assert.equal(mapDoctor({ ...doctor, longitude: 181 }).latitude, null);
  const d = mapDoctor({ ...doctor, visitingStart: "", visitingEnd: "" });
  assert.equal(d.visitingStart, null); assert.equal(d.visitingEnd, null); assert.equal(d.latitude, 33.5);
});
test("Zero coordinates are real values; no falsy coercion", () => {
  assert.equal(mapDoctor({ ...doctor, latitude: 0, longitude: 0 }).latitude, 0);
});
test("Projection has no mutation; empty records stay empty", () => {
  const before = structuredClone(doctor); mapDoctor(doctor); assert.deepEqual(doctor, before);
  assert.deepEqual([].map(mapDoctor), []);
});
const doctors = [doctor, { ...doctor, id: 2, latitude: 33.501 }, { ...doctor, id: 3, latitude: 33.502 }];
const input = { region: doctor.region, startPointId: "demo-south", startTime: "09:00", visitDurationMinutes: 15, travelSpeedKmh: 25, preserveSelectionOrder: false };
test("Default route remains greedy; manual reversal recalculates times", () => {
  const normal = calculateSmartRoute(input, DEMO_START_POINTS[0], doctors);
  const manual = calculateSmartRoute({ ...input, doctorIds: [3, 2, 1], preserveSelectionOrder: true }, DEMO_START_POINTS[0], doctors);
  assert.deepEqual(normal.stops.map(s => s.doctorId), [1, 2, 3]);
  assert.deepEqual(manual.stops.map(s => s.doctorId), [3, 2, 1]);
  assert.notEqual(normal.stops[0].arrivalTime, manual.stops[0].arrivalTime);
  assert.notEqual(normal.endTime, manual.endTime);
});
test("Manual order rejects a missed window instead of silently optimizing it", () => {
  const plan = calculateSmartRoute({ ...input, doctorIds: [3, 2, 1], preserveSelectionOrder: true }, DEMO_START_POINTS[0],
    doctors.map(d => d.id === 2 ? { ...d, visitingEnd: "09:20" } : d));
  assert.deepEqual(plan.stops.map(s => s.doctorId), [3, 1]);
  assert.equal(plan.omitted.find(d => d.doctorId === 2)?.reasonCode, "cannot_fit_after_selected_visits");
});
