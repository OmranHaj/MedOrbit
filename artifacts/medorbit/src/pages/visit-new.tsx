import { useCallback, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateVisit, useListDoctors, useListProducts, type VisitOutcome } from "@workspace/api-client-react";
import { Loader2, Save } from "lucide-react";
import { PageHeader, Panel, Field, Btn, Banner, ErrorState, Skel, LinkBtn, PrivacyNote } from "@/components/ui-kit";
import { VisitVerification } from "@/components/verify/visit-verification";
import { getListClinicDemoVisitsQueryKey, getListPendingVisitsQueryKey } from "@workspace/api-client-react";
import { errMsg, invalidateVisits, OUTCOMES, todayISO } from "@/lib/format";

type Errs = Partial<Record<"doctorId" | "productId" | "outcome" | "notes" | "date", string>>;

export default function VisitNew() {
  const pre = new URLSearchParams(useSearch()).get("doctorId") ?? "";
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const doctors = useListDoctors();
  const products = useListProducts();
  const m = useCreateVisit();
  const [doctorId, setDoctorId] = useState(/^\d+$/.test(pre) ? pre : "");
  const [productId, setProductId] = useState("");
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [errs, setErrs] = useState<Errs>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const today = todayISO();
  const [userPicked, setUserPicked] = useState(/^\d+$/.test(pre));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const recoverDoctor = useCallback((id: string) => setDoctorId((cur) => cur || id), []);

  const validate = (): Errs => {
    const e: Errs = {};
    if (!doctorId || !doctors.data?.some((d) => String(d.id) === doctorId)) e.doctorId = "اختر طبيباً.";
    if (!productId) e.productId = "اختر منتجاً.";
    if (!OUTCOMES.includes(outcome as VisitOutcome)) e.outcome = "اختر نتيجة الزيارة.";
    const n = notes.trim().length;
    if (n < 3) e.notes = "اكتب ملاحظة مهنية من 3 أحرف على الأقل."; else if (n > 2000) e.notes = "الحد الأقصى 2000 حرف.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) e.date = "أدخل تاريخاً صحيحاً.";
    else if (date > today) e.date = "لا يمكن أن يكون تاريخ الزيارة في المستقبل.";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerErr(null);
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) { document.getElementById(Object.keys(e)[0])?.focus(); return; }
    if (!pendingId) { setServerErr("أكّد الزيارة برمز العيادة التجريبي للطبيب المختار قبل الحفظ."); return; }
    try {
      await m.mutateAsync({ data: { pendingVisitId: pendingId, doctorId: Number(doctorId), productId: Number(productId), outcome: outcome as VisitOutcome, notes: notes.trim(), date } });
      setSaved(true);
      await Promise.all([invalidateVisits(qc), qc.invalidateQueries({ queryKey: getListPendingVisitsQueryKey() }), qc.invalidateQueries({ queryKey: getListClinicDemoVisitsQueryKey() })]);
      nav(pre ? `/doctors/${doctorId}?saved=visit` : "/visits?saved=1");
    } catch (er) { qc.invalidateQueries({ queryKey: getListPendingVisitsQueryKey() }); setServerErr(errMsg(er, "تعذّر حفظ التقرير. حاول مجدداً.")); }
  };

  const depsLoading = doctors.isLoading || products.isLoading;
  return (
    <>
      <PageHeader eyebrow="التقارير" title="تقرير زيارة جديد" subtitle="سجّل ما دار في الزيارة بإيجاز ووضوح." action={<LinkBtn href={pre ? `/doctors/${pre}` : "/visits"} variant="ghost" testId="link-cancel">إلغاء</LinkBtn>} />
      <Panel className="p-5 sm:p-7">
        {doctors.isError && <div className="mb-4"><ErrorState message="تعذّر تحميل قائمة الأطباء." onRetry={() => doctors.refetch()} testId="error-doctors" /></div>}
        {products.isError && <div className="mb-4"><ErrorState message="تعذّر تحميل قائمة المنتجات." onRetry={() => products.refetch()} testId="error-products" /></div>}
        {depsLoading ? <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-14" />)}</div> : (
          <form onSubmit={submit} noValidate className="space-y-5">
            {serverErr && <Banner kind="error">{serverErr}</Banner>}
            {doctors.data && doctors.data.length === 0 && <Banner kind="error">لا يوجد أطباء بعد. أضف طبيباً أولاً من صفحة الأطباء.</Banner>}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-4">
              <Field label="الطبيب" htmlFor="doctorId" error={errs.doctorId}>
                <select id="doctorId" data-testid="select-doctor" className="field-input" value={doctorId} onChange={(e) => { setUserPicked(true); setPendingId(null); setDoctorId(e.target.value); }} aria-invalid={!!errs.doctorId} disabled={!doctors.data}>
                  <option value="">اختر الطبيب...</option>
                  {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
                </select>
              </Field>
              <VisitVerification doctorId={doctorId} doctorName={doctors.data?.find((d) => String(d.id) === doctorId)?.name} userPicked={userPicked} onRecoverDoctor={recoverDoctor} onEligible={setPendingId} />
              </div>
              <Field label="المنتج الذي نوقش" htmlFor="productId" error={errs.productId}>
                <select id="productId" data-testid="select-product" className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)} aria-invalid={!!errs.productId} disabled={!products.data}>
                  <option value="">اختر المنتج...</option>
                  {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="تاريخ الزيارة" htmlFor="date" error={errs.date}>
                <input id="date" type="date" max={today} data-testid="input-date" className="field-input num" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errs.date} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-primary">نتيجة الزيارة</legend>
              <div id="outcome" tabIndex={-1} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OUTCOMES.map((o) => (
                  <label key={o} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${outcome === o ? "border-accent bg-secondary text-secondary-foreground" : "border-input bg-card hover:border-accent/50"}`}>
                    <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="sr-only" data-testid={`radio-outcome-${o}`} />{o}
                  </label>
                ))}
              </div>
              {errs.outcome && <p className="mt-1.5 text-xs font-medium text-destructive">{errs.outcome}</p>}
            </fieldset>
            <Field label="الملاحظات المهنية" htmlFor="notes" error={errs.notes} hint={`${notes.trim().length} / 2000`}>
              <textarea id="notes" rows={5} maxLength={2000} data-testid="input-notes" className="field-input resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} aria-invalid={!!errs.notes} placeholder="مثال: ناقشنا نتائج الدراسة الأخيرة، وطلب الطبيب ملخصاً علمياً في الزيارة القادمة." />
            </Field>
            <PrivacyNote compact />
            <div className="flex justify-end border-t border-border pt-5">
              <Btn type="submit" variant="teal" disabled={m.isPending || saved || !pendingId || !doctors.data || !products.data} data-testid="button-submit-visit" className="w-full sm:w-auto">
                {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{m.isPending ? "جارٍ الحفظ..." : "حفظ التقرير"}
              </Btn>
            </div>
          </form>
        )}
      </Panel>
    </>
  );
}
