import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDoctorBriefing } from "./doctor-briefing";
import { explicitRequestQuotes, safeProfessionalText } from "./briefing-safety";

const doctor = { id: 1, name: "طبيب اختبار خيالي", scientificInterests: "مراجعة الأدلة العلمية", createdAt: "2026-10-01T12:00:00.000Z" };
type Visit = Parameters<typeof buildDoctorBriefing>[1][number];
const visit = (extra: Partial<Visit> = {}): Visit => ({
  id: 1, date: "2026-11-01", productId: 1, productName: "منتج خيالي",
  outcome: "متابعة لاحقة", notes: "طلب الطبيب ملخصًا عن مراجعة الأدلة العلمية.",
  verificationStatus: "Confirmed by clinic demo code", ...extra,
});

test("No visits never invents a timeline, product, request, or follow-up", () => {
  const b = buildDoctorBriefing(doctor, [], 0);
  assert.equal(b.generativeAiUsed, false); assert.equal(b.label, "ملخص آلي منظّم");
  for (const list of [b.timeline, b.productsDiscussed, b.outstandingRequests, b.suggestedFollowUp]) assert.equal(list.length, 0);
  assert.equal(b.declaredScientificInterests.sourceField, "scientificInterests");
  assert.equal(b.declaredScientificInterests.visitCitations.length, 0);
});
test("Saved exact requests have dated citations but no inferred completion state", () => {
  const first = visit(), later = visit({ id: 2, date: "2026-11-02", notes: "تم إرسال الملخص العلمي المطلوب." });
  const b = buildDoctorBriefing(doctor, [first, later], 2);
  assert.equal(b.outstandingRequests.length, 1);
  const request = b.outstandingRequests[0];
  assert.ok(first.notes.includes(request.quote));
  assert.equal(request.state, "untracked"); assert.match(request.notice, /ليس تأكيدًا/);
  assert.equal(request.citations[0].visitId, first.id); assert.equal(request.citations[0].date, first.date);
  assert.equal(b.timeline[0].visitId, later.id);
});
test("Cancelled visits do not count as products discussed or actual requests", () => {
  const b = buildDoctorBriefing(doctor, [visit({ outcome: "لم تتم الزيارة" })], 1);
  assert.equal(b.productsDiscussed.length, 0); assert.equal(b.outstandingRequests.length, 0);
  assert.equal(b.suggestedFollowUp[0].citations[0].visitId, 1);
  assert.match(b.suggestedFollowUp[0].text, /تنسيق وقت/);
});
test("Negated, hypothetical and explicitly completed requests are not labelled outstanding", () => {
  for (const note of ["لم يطلب الطبيب ملخصًا.", "قد يطلب الطبيب ملخصًا.", "ربما يطلب الطبيب ملخصًا.",
    "طلب الطبيب ملخصًا وتم إرساله.", "يرجى إرسال الملخص وتم تسليمه."]) {
    assert.deepEqual(explicitRequestQuotes(note), []);
  }
});
test("Potential patient/contact/personality/prescribing text is withheld, not summarized", () => {
  for (const note of ["اسم المريض [معلومة محجوبة]", "Patient [redacted]", "الطبيب عصبي وعنيد",
    "يفضل وصف الدواء", "طلب الطبيب الاتصال على ٠٩٩٩٩٩٩٩٩٩", "تواصل عبر demo@example.invalid"]) {
    assert.equal(safeProfessionalText(note), null);
    const b = buildDoctorBriefing(doctor, [visit({ notes: note })], 1);
    assert.equal(b.privacyOmittedVisitCount, 1);
    assert.equal(b.timeline[0].notesExcerpt, null);
    assert.equal(b.timeline[0].citation.excerpt, "");
    assert.deepEqual(b.outstandingRequests, []);
    assert.ok(!JSON.stringify(b).includes(note));
  }
});
test("Profile interests are not attributed to unrelated reports", () => {
  const unmatched = buildDoctorBriefing(doctor, [visit({ notes: "مناقشة مهنية عامة فقط." })], 1);
  assert.equal(unmatched.declaredScientificInterests.visitCitations.length, 0);
  const matched = buildDoctorBriefing(doctor, [visit()], 1);
  assert.equal(matched.declaredScientificInterests.visitCitations[0].visitId, 1);
  assert.equal(matched.declaredScientificInterests.visitCitations[0].date, "2026-11-01");
});
test("Older unverified reports stay visibly unverified, with original dates", () => {
  const b = buildDoctorBriefing(doctor, [visit({ verificationStatus: "Unverified legacy report" })], 1);
  assert.equal(b.productsDiscussed[0].citations[0].verificationStatus, "Unverified legacy report");
  assert.equal(b.productsDiscussed[0].citations[0].date, "2026-11-01");
});
test("Concise bounds and date/id ordering do not pretend all reports were reviewed", () => {
  const records = Array.from({ length: 130 }, (_, i) => visit({ id: i + 1 }));
  const b = buildDoctorBriefing(doctor, records, 130);
  assert.equal(b.totalVisitCount, 130); assert.equal(b.reviewedVisitCount, 100);
  assert.equal(b.timeline.length, 5); assert.equal(b.timeline[0].visitId, 130);
  assert.equal(b.outstandingRequests.length, 3);
  assert.equal(b.productsDiscussed[0].recordCount, 100);
});
