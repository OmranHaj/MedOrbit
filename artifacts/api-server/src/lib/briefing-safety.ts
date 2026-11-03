/** Conservative display filter, not a comprehensive medical DLP system.
 * No text is sent to an external service. The app remains fictional-data-only. */
export function normalizeArabic(text: string) {
  return text.normalize("NFKC").replace(/\p{M}/gu, "").replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}
export function safeProfessionalText(text: string): string | null {
  const normalized = normalizeArabic(text);
  const digits = normalized.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  // Withhold the entire free-text field if it may contain patient/contact data,
  // personality/sensitive traits, prescribing claims, or explicit preferences.
  const excluded = /مريض|مرضي|ملف طبي|رقم ملف|هوية|هاتف|جوال|رقم تواصل|بريد الكتروني|وصفة|وصفات|روشتة|يصف|تصف|يصرف|توصي[ةات]+ علاجي|يفضل|تفضل|عصبي|عنيد|مزاج|شخصيته|طبعه|متكبر|بخيل|متزوج|ديانته|جنسيته|انتما[ءئ]|patient|prescri|personality|phone|email/i;
  if (excluded.test(normalized) || /(?:\+?\d[\s().-]*){7,}/.test(digits) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return null;
  return text.trim();
}
export const excerpt = (text: string, limit = 220) => text.slice(0, limit).trimEnd();

/** Extract only explicit recorded request sentences. Do not infer completion. */
export function explicitRequestQuotes(note: string): string[] {
  return note.split(/[\n.!?؟؛]+/u).map((sentence) => sentence.trim()).filter((sentence) => {
    const normalized = normalizeArabic(sentence);
    if (!/(?:^|\s)(?:و?طلب(?:ت)?|و?يطلب|و?تطلب|يرجي)\s/.test(normalized)) return false;
    if (/(?:^|\s)(?:لم|لن|لا|قد|ربما)\s+(?:يطلب|تطلب|نطلب|اطلب)|لا\s*يطلب|(?:تم|تمت)\s+(?:ارسال|تسليم|تلبي|انجاز)|انجز(?:نا|ت)?\s/.test(normalized)) return false;
    return true;
  }).map((sentence) => excerpt(sentence, 240));
}
