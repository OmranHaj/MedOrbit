import { useState } from "react";
import type { DoctorInput } from "@workspace/api-client-react";
import { Loader2, Save } from "lucide-react";
import { Btn, Field, Banner } from "@/components/ui-kit";

type Vals = Record<keyof DoctorInput, string>;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const emptyDoctor: Vals = { name: "", specialty: "", region: "", clinicAddress: "", latitude: "", longitude: "", visitingStart: "09:00", visitingEnd: "13:00", scientificInterests: "" };

export function toVals(d: DoctorInput): Vals {
  return { ...d, latitude: String(d.latitude), longitude: String(d.longitude) };
}

function validate(v: Vals): [Partial<Vals>, DoctorInput | null] {
  const e: Partial<Vals> = {};
  const txt = (k: keyof Vals, min: number, max: number, label: string) => {
    const t = v[k].trim();
    if (t.length < min) e[k] = `${label}: ${min} أحرف على الأقل.`;
    else if (t.length > max) e[k] = `${label}: ${max} حرفاً كحد أقصى.`;
  };
  txt("name", 2, 100, "الاسم"); txt("specialty", 2, 100, "التخصص"); txt("region", 2, 100, "المنطقة");
  txt("clinicAddress", 3, 250, "العنوان"); txt("scientificInterests", 2, 1000, "الاهتمامات");
  const lat = Number(v.latitude), lng = Number(v.longitude);
  if (v.latitude.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) e.latitude = "خط العرض رقم بين ‎-90 و 90.";
  if (v.longitude.trim() === "" || !Number.isFinite(lng) || lng < -180 || lng > 180) e.longitude = "خط الطول رقم بين ‎-180 و 180.";
  if (!TIME.test(v.visitingStart)) e.visitingStart = "أدخل وقتاً صحيحاً.";
  if (!TIME.test(v.visitingEnd)) e.visitingEnd = "أدخل وقتاً صحيحاً.";
  else if (TIME.test(v.visitingStart) && v.visitingStart >= v.visitingEnd) e.visitingEnd = "يجب أن تكون نهاية الزيارة بعد بدايتها.";
  if (Object.keys(e).length) return [e, null];
  return [e, { name: v.name.trim(), specialty: v.specialty.trim(), region: v.region.trim(), clinicAddress: v.clinicAddress.trim(), latitude: lat, longitude: lng, visitingStart: v.visitingStart, visitingEnd: v.visitingEnd, scientificInterests: v.scientificInterests.trim() }];
}

export function DoctorForm({ initial, onSubmit, pending, submitLabel, serverError }: { initial: Vals; onSubmit: (d: DoctorInput) => void; pending: boolean; submitLabel: string; serverError?: string | null }) {
  const [v, setV] = useState<Vals>(initial);
  const [errs, setErrs] = useState<Partial<Vals>>({});
  const [tried, setTried] = useState(false);
  const set = (k: keyof Vals) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = { ...v, [k]: ev.target.value };
    setV(next);
    if (tried) setErrs(validate(next)[0]);
  };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTried(true);
    const [e, data] = validate(v);
    setErrs(e);
    if (data) onSubmit(data);
    else document.getElementById(Object.keys(e)[0])?.focus();
  };
  const inp = (k: keyof Vals, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={k} data-testid={`input-${k}`} value={v[k]} onChange={set(k)} aria-invalid={!!errs[k]} aria-describedby={errs[k] ? `${k}-err` : undefined} className="field-input" {...props} />
  );
  const errCount = Object.keys(errs).length;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {serverError && <Banner kind="error">{serverError}</Banner>}
      {tried && errCount > 0 && <Banner kind="error">يرجى تصحيح {errCount === 1 ? "حقل واحد" : `${errCount} حقول`} قبل الحفظ.</Banner>}
      <section className="grid gap-5 sm:grid-cols-2">
        <h2 className="font-display text-sm font-semibold text-muted-foreground sm:col-span-2">البيانات المهنية</h2>
        <Field label="اسم الطبيب (خيالي)" htmlFor="name" error={errs.name}>{inp("name", { placeholder: "د. سلمى الراشد", maxLength: 100 })}</Field>
        <Field label="التخصص" htmlFor="specialty" error={errs.specialty}>{inp("specialty", { placeholder: "طب القلب", maxLength: 100 })}</Field>
        <Field label="المنطقة" htmlFor="region" error={errs.region}>{inp("region", { placeholder: "حي النخيل", maxLength: 100 })}</Field>
        <Field label="عنوان العيادة (خيالي)" htmlFor="clinicAddress" error={errs.clinicAddress}>{inp("clinicAddress", { placeholder: "مجمع الواحة الطبي، شارع الياسمين ١٢", maxLength: 250 })}</Field>
      </section>
      <section className="grid gap-5 sm:grid-cols-2">
        <h2 className="font-display text-sm font-semibold text-muted-foreground sm:col-span-2">الموقع وأوقات الزيارة</h2>
        <Field label="خط العرض" htmlFor="latitude" error={errs.latitude} hint="بين ‎-90 و 90">{inp("latitude", { inputMode: "decimal", dir: "ltr", placeholder: "24.7136", className: "field-input text-right num" })}</Field>
        <Field label="خط الطول" htmlFor="longitude" error={errs.longitude} hint="بين ‎-180 و 180">{inp("longitude", { inputMode: "decimal", dir: "ltr", placeholder: "46.6753", className: "field-input text-right num" })}</Field>
        <Field label="بداية وقت الزيارة" htmlFor="visitingStart" error={errs.visitingStart}>{inp("visitingStart", { type: "time", className: "field-input num" })}</Field>
        <Field label="نهاية وقت الزيارة" htmlFor="visitingEnd" error={errs.visitingEnd}>{inp("visitingEnd", { type: "time", className: "field-input num" })}</Field>
      </section>
      <section>
        <Field label="الاهتمامات العلمية" htmlFor="scientificInterests" error={errs.scientificInterests} hint={`${v.scientificInterests.trim().length} / 1000`}>
          <textarea id="scientificInterests" data-testid="input-scientificInterests" rows={4} maxLength={1000} value={v.scientificInterests} onChange={set("scientificInterests")} aria-invalid={!!errs.scientificInterests} className="field-input resize-y" placeholder="مثال: أحدث إرشادات ضغط الدم، الدراسات السريرية حول الكوليسترول" />
        </Field>
      </section>
      <div className="flex justify-end border-t border-border pt-5">
        <Btn type="submit" variant="teal" disabled={pending} data-testid="button-submit-doctor" className="w-full sm:w-auto">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{pending ? "جارٍ الحفظ..." : submitLabel}
        </Btn>
      </div>
    </form>
  );
}
