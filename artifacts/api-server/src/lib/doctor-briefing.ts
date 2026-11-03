import type { GetDoctorBriefingResponse, GetDoctorResponse, ListVisitsResponse } from "@workspace/api-zod";
import { excerpt, explicitRequestQuotes, safeProfessionalText } from "./briefing-safety";

export const BRIEFING_REPORT_LIMIT = 100;
type Briefing = ReturnType<typeof GetDoctorBriefingResponse.parse>;
type Doctor = Pick<ReturnType<typeof GetDoctorResponse.parse>, "id" | "name" | "scientificInterests" | "createdAt">;
type Visit = Pick<ReturnType<typeof ListVisitsResponse.parse>[number],
  "id" | "date" | "productId" | "productName" | "outcome" | "notes" | "verificationStatus">;
const REQUEST_NOTICE = "حالة الإنجاز غير مسجّلة لكل طلب. هذا مقتطف من تقرير، وليس تأكيدًا بأن الطلب ما زال معلّقًا؛ تحقّق من حالته أولًا.";
const LIMITATIONS = [
  "ملخص آلي منظّم بقواعد ثابتة، دون أي نموذج لغوي أو ذكاء اصطناعي توليدي؛ لا تُرسل البيانات إلى خدمة خارجية.",
  "مصدر الوقائع تقارير الزيارات المحفوظة، وليس تفضيلات دائمة للطبيب أو ادعاءات وصف أدوية أو تقييمًا لشخصيته.",
  "تُراجع أحدث 100 تقرير حسب تاريخ الزيارة ثم معرّف السجل، ويُعرض أحدث 5 في الخط الزمني، وحتى 8 منتجات و3 طلبات. لكل نقطة سجل وتاريخ.",
  "المنتجات والطلبات لا تُستنتج من التقارير التي نتيجتها «لم تتم الزيارة». نتيجة التقرير تعكس ما سجّله المندوب ولا تثبت تفضيلًا أو توصية طبية.",
  "الاهتمامات العلمية مصدرها حقل الملف الحالي؛ تاريخ إضافة الملف ليس تاريخ تحديثه أو إثبات مناقشة تلك الاهتمامات في زيارة.",
  "الطلبات المذكورة ليست قائمة مهام بحالة إنجاز. الاقتراحات خطوات تحقق مهنية وليست طلبات جديدة أو مواعيد مؤكدة.",
  "تحجب القواعد النصوص المحتمل احتواؤها على بيانات مرضى أو اتصال أو سمات شخصية أو ادعاءات وصف. هذا ليس نظام كشف شاملًا؛ استخدم بيانات خيالية مهنية فقط.",
];

/** Deterministic, read-only projection; does not write reports or call a model. */
export function buildDoctorBriefing(doctor: Doctor, reports: Visit[], totalVisitCount: number): Briefing {
  const visits = reports.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, BRIEFING_REPORT_LIMIT);
  const notes = new Map(visits.map((visit) => [visit.id, safeProfessionalText(visit.notes)]));
  const citation = (visit: Visit, quote?: string) => ({
    visitId: visit.id, date: visit.date,
    excerpt: quote ?? excerpt(notes.get(visit.id) ?? ""),
    verificationStatus: visit.verificationStatus,
  });
  const timeline = visits.slice(0, 5).map((visit) => ({
    visitId: visit.id, date: visit.date, productId: visit.productId, productName: visit.productName,
    outcome: visit.outcome, notesExcerpt: notes.get(visit.id) ? excerpt(notes.get(visit.id)!) : null,
    notesWithheld: notes.get(visit.id) === null, citation: citation(visit),
  }));
  const completed = visits.filter((visit) => visit.outcome !== "لم تتم الزيارة");
  const productGroups = new Map<number, Visit[]>();
  for (const visit of completed) {
    const group = productGroups.get(visit.productId) ?? [];
    group.push(visit); productGroups.set(visit.productId, group);
  }
  const productsDiscussed = [...productGroups.entries()].slice(0, 8).map(([productId, group]) => ({
    productId, productName: group[0].productName, recordCount: group.length,
    // References prove the saved product association, not prescribing behavior.
    citations: group.slice(0, 3).map((visit) => citation(visit, "")),
  }));
  const interests = safeProfessionalText(doctor.scientificInterests);
  const interestMentions = interests ? completed.filter((visit) => notes.get(visit.id)?.includes(interests)).slice(0, 3) : [];
  const declaredScientificInterests = {
    text: interests, sourceField: "scientificInterests" as const, profileCreatedAt: doctor.createdAt,
    visitCitations: interestMentions.map((visit) => citation(visit, excerpt(interests!))),
    notice: !interests ? "لا توجد اهتمامات قابلة للعرض بأمان في حقل الملف؛ لا نستنتجها من نتيجة الزيارة." :
      interestMentions.length ? "المصدر هو حقل الملف الحالي، وتظهر أدناه تقارير تذكر النص نفسه صراحة؛ لا نستنتج تفضيلات إضافية." :
        "المصدر هو حقل الاهتمامات العلمية في الملف فقط. لم نجد ذكرًا مطابقًا لهذا النص ضمن التقارير المراجعة؛ لا ننسبه إلى زيارة أو تاريخ نقاش غير موثّق.",
  };
  const outstandingRequests: Briefing["outstandingRequests"] = [];
  for (const visit of completed) {
    const note = notes.get(visit.id);
    if (!note) continue;
    for (const quote of explicitRequestQuotes(note)) {
      outstandingRequests.push({
        quote, state: "untracked", notice: REQUEST_NOTICE, citations: [citation(visit, quote)],
      });
      if (outstandingRequests.length >= 3) break;
    }
    if (outstandingRequests.length >= 3) break;
  }
  const suggestedFollowUp: Briefing["suggestedFollowUp"] = [];
  if (outstandingRequests[0]) suggestedFollowUp.push({
    text: "ابدأ بالتحقق من حالة الطلب المقتبس في التقرير أدناه قبل اقتراح خطوة أخرى؛ لا نفترض أنه لم يُنجز.",
    citations: outstandingRequests[0].citations,
  });
  const latest = visits[0];
  if (latest) {
    const suggestions: Record<Visit["outcome"], string> = {
      "لم تتم الزيارة": "اقترح تنسيق وقت مهني آخر ضمن نافذة الاستقبال؛ آخر تقرير سجّل «لم تتم الزيارة»، فلا نفترض حصول مناقشة للمنتج.",
      "غير مهتم": "استوضح أولًا إن كانت هناك حاجة لمتابعة مهنية أخرى؛ نتيجة آخر تقرير «غير مهتم» وليست وصفًا دائمًا لشخصية الطبيب أو تفضيلاته.",
      "متابعة لاحقة": "نسّق خطوة متابعة مهنية لما وُثّق في آخر تقرير، مع تأكيد الحاجة والوقت بدل افتراض موعد أو تفضيل غير مسجّل.",
      "مهتم": "استوضح خطوة المتابعة المهنية المناسبة بناءً على آخر تقرير؛ نتيجة «مهتم» لا تثبت تبنّي المنتج أو تفضيلًا دائمًا أو وصفه للمرضى.",
    };
    suggestedFollowUp.push({ text: suggestions[latest.outcome], citations: [citation(latest, "")] });
  }
  return {
    doctorId: doctor.id, doctorName: doctor.name, label: "ملخص آلي منظّم", engine: "rules",
    generativeAiUsed: false, generatedAt: new Date().toISOString(),
    totalVisitCount, reviewedVisitCount: visits.length, timeline, productsDiscussed,
    declaredScientificInterests, outstandingRequests, suggestedFollowUp,
    privacyOmittedVisitCount: visits.filter((visit) => notes.get(visit.id) === null).length,
    limitations: LIMITATIONS,
  };
}
