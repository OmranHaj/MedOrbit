import type { DoctorRecord } from "@workspace/db";

const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Projection only. Invalid legacy fields are described, never repaired in storage. */
export function mapDoctor(d: DoctorRecord) {
  const located = typeof d.latitude === "number" && Number.isFinite(d.latitude) && Math.abs(d.latitude) <= 90 &&
    typeof d.longitude === "number" && Number.isFinite(d.longitude) && Math.abs(d.longitude) <= 180;
  const hours = clock.test(d.visitingStart) && clock.test(d.visitingEnd) && d.visitingStart < d.visitingEnd;
  return {
    id: d.id, name: d.name, specialty: d.specialty, region: d.region, clinicAddress: d.clinicAddress,
    latitude: located ? d.latitude : null, longitude: located ? d.longitude : null,
    visitingStart: hours ? d.visitingStart : null, visitingEnd: hours ? d.visitingEnd : null,
  };
}
