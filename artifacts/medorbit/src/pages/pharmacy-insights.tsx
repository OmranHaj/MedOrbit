import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useGetPharmacyComparison,
  getGetPharmacyComparisonQueryKey,
  useCreatePharmacyObservation,
  useUpdatePharmacyObservation,
  getGetDashboardQueryKey,
  PharmacyRegion,
  PharmacyAvailability,
  PharmacySource,
  type PharmacyObservation,
  type PharmacyObservationInput,
} from "@workspace/api-client-react";
import { AlertTriangle, BarChart3, Pencil, Save, X, Package } from "lucide-react";
import { PageHeader, Panel, Skel, ErrorState, EmptyState, Banner, Btn, Field, LinkBtn } from "@/components/ui-kit";
import { errMsg, fmtNum } from "@/lib/format";

const REGIONS = Object.values(PharmacyRegion);
const AVAIL = Object.values(PharmacyAvailability);
const SOURCES = Object.values(PharmacySource);
const PERIOD_RE = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;
export const ECOLOGICAL_WARNING = "المبيعات الإقليمية لا تثبت سلوك وصف أي طبيب بعينه، ولا تُستخدم لتقييم الأطباء.";
export const SUPPLY_WARNING = "قد يكون انخفاض المبيعات نتيجة نقص التوفر، وليس ضعف الطلب أو سلوك الأطباء.";

function damascusMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (!y || !m) throw new Error("تعذّر تحديد شهر الإبلاغ الحالي.");
  return `${y}-${m}`;
}
function fmtMonth(p: string) {
  if (!PERIOD_RE.test(p)) return p;
  const [y, m] = p.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

type Form = { productId: string; region: string; period: string; units: string; availability: string; source: string };
const blank = (productId: string, period: string): Form => ({ productId, region: "", period, units: "", availability: "", source: "" });

const availStyle: Record<string, string> = {
  "متوفر": "bg-teal-50 text-teal-800 ring-teal-600/25",
  "محدود": "bg-amber-50 text-amber-800 ring-amber-600/25",
  "غير متوفر": "bg-rose-50 text-rose-800 ring-rose-600/20",
};

export default function PharmacyInsights() {
  const qc = useQueryClient();
  const products = useListProducts();
  const [fProduct, setFProduct] = useState("");
  const [fPeriod, setFPeriod] = useState(damascusMonth());
  const pid = Number(fProduct);
  const validFilters = pid > 0 && PERIOD_RE.test(fPeriod);
  const params = { productId: pid, period: fPeriod };
  const cmp = useGetPharmacyComparison(params, {
    query: { queryKey: getGetPharmacyComparisonQueryKey(params), enabled: validFilters, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000 },
  });
  const create = useCreatePharmacyObservation();
  const update = useUpdatePharmacyObservation();

  const [form, setForm] = useState<Form>(blank("", damascusMonth()));
  const [editing, setEditing] = useState<PharmacyObservation | null>(null);
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = saving || create.isPending || update.isPending;

  useEffect(() => {
    const prev = document.title;
    document.title = "مؤشرات الصيدليات | ميد أوربت";
    return () => { document.title = prev; };
  }, []);

  // default the filter to first product once loaded (does not touch form)
  const firstId = products.data?.[0]?.id;
  useEffect(() => {
    if (firstId && !fProduct) {
      setFProduct(String(firstId));
      setForm((f) => (f.productId ? f : { ...f, productId: String(firstId) }));
    }
  }, [firstId, fProduct]);

  const productName = useMemo(() => {
    const m = new Map<number, string>();
    products.data?.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products.data]);

  const set = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: undefined })); };

  function startEdit(o: PharmacyObservation) {
    setEditing({ ...o });
    setForm({ productId: String(o.productId), region: o.region, period: o.period, units: String(o.unitsSold), availability: o.availability, source: o.sourceLabel });
    setErrs({}); setServerErr(null); setOk(null);
    document.getElementById("pharmacy-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelEdit() {
    setEditing(null);
    setForm(blank(fProduct, fPeriod));
    setErrs({}); setServerErr(null);
  }

  function validate(): PharmacyObservationInput | null {
    const e: Partial<Record<keyof Form, string>> = {};
    const p = Number(form.productId);
    if (!(p > 0)) e.productId = "اختر منتجاً من الكتالوج.";
    if (!REGIONS.includes(form.region as PharmacyRegion)) e.region = "اختر الإقليم.";
    if (!PERIOD_RE.test(form.period)) e.period = "اختر شهراً صالحاً بصيغة سنة-شهر.";
    const u = form.units.trim();
    const n = Number(u);
    if (u === "" || !/^\d+$/.test(u) || !Number.isInteger(n) || n < 0 || n > 1000000) e.units = "أدخل عدداً صحيحاً بين ٠ و١٬٠٠٠٬٠٠٠.";
    if (!AVAIL.includes(form.availability as PharmacyAvailability)) e.availability = "اختر حالة التوفر.";
    if (!SOURCES.includes(form.source as PharmacySource)) e.source = "اختر مصدر التجميع.";
    setErrs(e);
    if (Object.keys(e).length) return null;
    return { productId: p, region: form.region as PharmacyRegion, period: form.period, unitsSold: n, availability: form.availability as PharmacyAvailability, sourceLabel: form.source as PharmacySource };
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (pending) return;
    setServerErr(null); setOk(null);
    const data = validate();
    if (!data) return;
    const editId = editing?.id;
    setSaving(true);
    try {
      const saved = editId != null ? await update.mutateAsync({ id: editId, data }) : await create.mutateAsync({ data });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetPharmacyComparisonQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      ]);
      setFProduct(String(saved.productId));
      setFPeriod(saved.period);
      setEditing(null);
      setForm(blank(String(saved.productId), saved.period));
      setOk(`${editId != null ? "تم تحديث" : "تم حفظ"} سجل ${saved.region} لشهر ${fmtMonth(saved.period)}: ${fmtNum(saved.unitsSold)} وحدة.`);
    } catch (er) {
      setServerErr(errMsg(er, "تعذّر حفظ السجل. حاول مجدداً."));
    } finally {
      setSaving(false);
    }
  }

  const d = cmp.data;
  const rows = d ? [...d.observations].sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region)) : [];
  const missing = d ? REGIONS.filter((r) => !d.observations.some((o) => o.region === r)) : [];
  const constrained = d ? d.hasSupplyConstraint || d.observations.some((o) => o.availability !== "متوفر") : false;
  const formConstrained = form.availability === "غير متوفر" || form.availability === "محدود";

  return (
    <>
      <PageHeader eyebrow="بيانات تجميعية خيالية" title="مؤشرات الصيدليات" subtitle="مقارنة إقليمية مبسطة لوحدات منتج واحد خلال شهر واحد. كل سجل هو مجموع إقليمي واحد، لا وصفات ولا مرضى." />

      <div role="note" data-testid="text-pharmacy-disclaimer" className="rise mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-bold">{ECOLOGICAL_WARNING}</p>
          <p>الأرقام تجميعات خيالية بالكامل على مستوى الإقليم. لا تحتوي على تفاصيل مرضى أو وصفات قابلة للتعريف أو صور وصفات، ومسميات المصادر لا تشير إلى صيدلية أو شخص حقيقي.</p>
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-5"><Skel className="h-96 lg:col-span-3" /><Skel className="h-96 lg:col-span-2" /></div>
      ) : products.isError ? (
        <ErrorState message="تعذّر تحميل كتالوج المنتجات." onRetry={() => products.refetch()} testId="error-pharmacy-products" />
      ) : !products.data || products.data.length === 0 ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="لا توجد منتجات في الكتالوج" body="تعتمد المقارنة على منتجات الكتالوج الخيالية. عند توفرها ستتمكن من إدخال المجاميع الإقليمية." action={<LinkBtn href="/products" variant="ghost" testId="link-pharmacy-products">صفحة المنتجات</LinkBtn>} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="min-w-0 space-y-4 lg:col-span-3">
            <Panel className="p-4 sm:p-5">
              <h2 className="font-display font-semibold text-primary">نطاق المقارنة</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="المنتج" htmlFor="filter-product">
                  <select id="filter-product" className="field-input" data-testid="filter-pharmacy-product" value={fProduct} onChange={(e) => setFProduct(e.target.value)}>
                    {products.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="الشهر" htmlFor="filter-period" error={PERIOD_RE.test(fPeriod) ? undefined : "اختر شهراً صالحاً."}>
                  <input id="filter-period" type="month" className="field-input num" data-testid="filter-pharmacy-period" value={fPeriod} onChange={(e) => setFPeriod(e.target.value)} aria-invalid={!PERIOD_RE.test(fPeriod)} />
                </Field>
              </div>
            </Panel>

            {!validFilters ? (
              <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="حدّد منتجاً وشهراً" body="اختر منتجاً وشهراً صالحين لعرض المقارنة." />
            ) : cmp.isLoading ? (
              <div className="space-y-3"><Skel className="h-24" /><Skel className="h-48" /></div>
            ) : cmp.isError || !d ? (
              <ErrorState message={errMsg(cmp.error, "تعذّر تحميل المقارنة.")} onRetry={() => cmp.refetch()} testId="error-pharmacy-comparison" />
            ) : (
              <Panel className="overflow-hidden">
                <div className="border-b border-border bg-muted/40 p-4 sm:p-5" data-testid="text-pharmacy-scope">
                  <p className="text-xs font-semibold text-accent">النطاق المعروض</p>
                  <p className="mt-0.5 font-display text-lg font-bold text-primary">{d.productName} <span className="text-muted-foreground">·</span> <span className="num">{fmtMonth(d.period)}</span></p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Mini label="مجموع الوحدات" value={d.totalUnits} id="pharmacy-total-units" />
                    <Mini label="سجلات إقليمية" value={d.observationCount} id="pharmacy-observation-count" />
                    <Mini label="أقاليم غير متوفر" value={d.unavailableCount} id="pharmacy-unavailable-count" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">العدد هو عدد السجلات المحفوظة لا عدد الصيدليات. مجموع الوحدات يخص هذا المنتج وهذا الشهر فقط من الأقاليم المسجلة، وليس إجمالي مبيعات السوق.</p>
                </div>

                {constrained && (
                  <div role="alert" data-testid="text-pharmacy-supply-warning" className="flex items-start gap-2.5 border-b border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{SUPPLY_WARNING}
                  </div>
                )}

                {rows.length === 0 ? (
                  <div className="p-5"><EmptyState icon={<BarChart3 className="h-5 w-5" />} title="لا توجد بيانات لهذا النطاق" body="لم يُحفظ أي سجل إقليمي لهذا المنتج في هذا الشهر. غياب البيانات لا يعني مبيعات صفرية." /></div>
                ) : (
                  <div className="w-full max-w-full overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-pharmacy-comparison">
                      <caption className="sr-only">مقارنة الوحدات حسب الإقليم لـ {d.productName} في {fmtMonth(d.period)}</caption>
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th scope="col" className="p-3 text-right font-semibold">الإقليم</th>
                          <th scope="col" className="p-3 text-right font-semibold">الوحدات</th>
                          <th scope="col" className="p-3 text-right font-semibold">التوفر</th>
                          <th scope="col" className="p-3 text-right font-semibold">المصدر</th>
                          <th scope="col" className="p-3 text-right font-semibold"><span className="sr-only">إجراء</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((o) => (
                          <tr key={o.id} data-testid={`row-pharmacy-${o.id}`} className={editing?.id === o.id ? "bg-secondary/60" : ""}>
                            <th scope="row" className="p-3 text-right font-semibold text-primary">{o.region}</th>
                            <td className="num p-3 font-display text-base font-bold" data-testid={`text-pharmacy-units-${o.id}`}>{fmtNum(o.unitsSold)}</td>
                            <td className="p-3">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${availStyle[o.availability]}`} data-testid={`status-pharmacy-availability-${o.id}`}>{o.availability}</span>
                              {o.availability !== "متوفر" && <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-rose-800" data-testid={`text-row-supply-warning-${o.id}`}>{SUPPLY_WARNING}</p>}
                            </td>
                            <td className="whitespace-nowrap p-3 text-muted-foreground">{o.sourceLabel}</td>
                            <td className="p-3 text-left">
                              <button type="button" onClick={() => startEdit(o)} disabled={pending} data-testid={`button-edit-pharmacy-${o.id}`} aria-label={`تعديل سجل ${o.region}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-muted disabled:opacity-50"><Pencil className="h-3.5 w-3.5" />تعديل</button>
                            </td>
                          </tr>
                        ))}
                        {missing.map((r) => (
                          <tr key={r} data-testid={`row-pharmacy-missing-${r}`} className="text-muted-foreground">
                            <th scope="row" className="p-3 text-right font-medium">{r}</th>
                            <td colSpan={4} className="p-3 text-xs">لا توجد بيانات (ليست صفراً)</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            )}
          </div>

          <div className="min-w-0 lg:col-span-2">
            <Panel className="p-4 sm:p-5 lg:sticky lg:top-8">
              <form id="pharmacy-form" onSubmit={submit} noValidate>
                <fieldset disabled={pending} className="min-w-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-primary">{editing ? `تعديل سجل #${editing.id}` : "إدخال مجموع إقليمي"}</h2>
                  {editing && <button type="button" onClick={cancelEdit} disabled={pending} data-testid="button-cancel-edit-pharmacy" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" />إلغاء التعديل</button>}
                </div>
                {ok && <Banner kind="success" onClose={() => setOk(null)}>{ok}</Banner>}
                {serverErr && <Banner kind="error" onClose={() => setServerErr(null)}>{serverErr}</Banner>}
                {!editing && <p className="text-xs text-muted-foreground">سجل واحد لكل منتج وإقليم وشهر. إن كان الإقليم مسجلاً، استخدم زر التعديل في الجدول بدل إضافة سجل مكرر.</p>}

                <Field label="المنتج" htmlFor="ph-product" error={errs.productId}>
                  <select id="ph-product" className="field-input" data-testid="input-pharmacy-product" value={form.productId} onChange={(e) => set("productId", e.target.value)} aria-invalid={!!errs.productId}>
                    <option value="">اختر منتجاً</option>
                    {products.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    {form.productId && !productName.has(Number(form.productId)) && <option value={form.productId}>منتج #{form.productId}</option>}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label="الإقليم" htmlFor="ph-region" error={errs.region}>
                    <select id="ph-region" className="field-input" data-testid="input-pharmacy-region" value={form.region} onChange={(e) => set("region", e.target.value)} aria-invalid={!!errs.region}>
                      <option value="">اختر الإقليم</option>
                      {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="الشهر" htmlFor="ph-period" error={errs.period}>
                    <input id="ph-period" type="month" className="field-input num" data-testid="input-pharmacy-period" value={form.period} onChange={(e) => set("period", e.target.value)} aria-invalid={!!errs.period} />
                  </Field>
                </div>
                <Field label="الوحدات المباعة (مجموع الإقليم)" htmlFor="ph-units" error={errs.units} hint="عدد صحيح من ٠ إلى ١٬٠٠٠٬٠٠٠. أدخل ٠ فقط إن كان المجموع المسجل صفراً فعلاً.">
                  <input id="ph-units" type="number" inputMode="numeric" min={0} max={1000000} step={1} className="field-input num" data-testid="input-pharmacy-units" value={form.units} onChange={(e) => set("units", e.target.value)} aria-invalid={!!errs.units} />
                </Field>
                <Field label="التوفر" htmlFor="ph-avail" error={errs.availability}>
                  <select id="ph-avail" className="field-input" data-testid="input-pharmacy-availability" value={form.availability} onChange={(e) => set("availability", e.target.value)} aria-invalid={!!errs.availability}>
                    <option value="">اختر حالة التوفر</option>
                    {AVAIL.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                {formConstrained && <p role="note" data-testid="text-form-supply-warning" className="rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-900">{SUPPLY_WARNING}</p>}
                <Field label="مصدر التجميع (خيالي)" htmlFor="ph-source" error={errs.source}>
                  <select id="ph-source" className="field-input" data-testid="input-pharmacy-source" value={form.source} onChange={(e) => set("source", e.target.value)} aria-invalid={!!errs.source}>
                    <option value="">اختر المصدر</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Btn type="submit" variant="teal" className="w-full" disabled={pending} data-testid="button-save-pharmacy">
                  <Save className="h-4 w-4" />{pending ? "جارٍ الحفظ..." : editing ? "حفظ التعديل" : "حفظ السجل"}
                </Btn>
                </fieldset>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function Mini({ label, value, id }: { label: string; value: number; id: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="num mt-1 font-display text-xl font-bold text-primary" data-testid={id}>{fmtNum(value)}</div>
    </div>
  );
}
