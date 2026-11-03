import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useGetDoctorMap, getGetDoctorMapQueryKey } from "@workspace/api-client-react";
import { AlertTriangle, MapPinOff, Route as RouteIcon, Search } from "lucide-react";
import { PageHeader, Panel, Skel, ErrorState, EmptyState } from "@/components/ui-kit";
import { LazyDoctorMap, locatedOnly } from "@/components/map/lazy-map";
import { useTour, toggleTourDoctor, setTourSelection, validMapCoordinates, validMapHours } from "@/hooks/use-tour";
import { MAP_QUERY, ROUTE_NOTICE, planIssue, usePageMeta } from "@/lib/map-tour";
import { errMsg } from "@/lib/format";

export default function DoctorMapPage() {
  usePageMeta("خريطة الأطباء | ميد أوربت", "خريطة تفاعلية لعيادات أطباء خياليين محفوظين، مع جولة يومية تقريبية بخطوط مستقيمة لأغراض التدريب فقط.");
  const q = useGetDoctorMap({ query: { queryKey: getGetDoctorMapQueryKey(), ...MAP_QUERY } });
  const tour = useTour();
  const raw = new URLSearchParams(useSearch()).get("doctorId");
  const focusId = raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [toggleMsg, setToggleMsg] = useState<string | null>(null);

  const docs = useMemo(() => q.data ?? [], [q.data]);
  const regions = useMemo(() => [...new Set(docs.map((d) => d.region))].sort(), [docs]);
  const specs = useMemo(() => [...new Set(docs.map((d) => d.specialty))].sort(), [docs]);
  const sel = new Set(tour.selectedIds);
  const term = search.trim();
  const filtered = docs.filter((d) => (!term || d.name.includes(term)) && (!region || d.region === region) && (!specialty || d.specialty === specialty) && (mode === "all" || sel.has(d.id)));
  const located = locatedOnly(filtered);
  const unlocated = filtered.filter((d) => !validMapCoordinates(d));
  const focusDoc = focusId ? docs.find((d) => d.id === focusId) : undefined;
  const markers = located;
  const markerIds = new Set(markers.map((d) => d.id));

  const issue = q.data && tour.plan ? planIssue(tour.plan, tour.planInput, tour.source, docs) : null;
  const plan = q.data && tour.plan && !issue ? tour.plan : null;
  const hiddenStops = plan ? plan.stops.filter((s) => !markerIds.has(s.doctorId)).length : 0;
  const invalidSel = q.data ? tour.selectedIds.filter((id) => !docs.some((d) => d.id === id)) : [];

  function toggle(id: number) {
    const ok = toggleTourDoctor(id);
    setToggleMsg(ok ? null : "تعذّر التعديل: الحد الأقصى 100 طبيب في الجولة.");
    return ok;
  }

  return (
    <div className="min-w-0">
      <PageHeader eyebrow="خريطة تدريبية" title="خريطة الأطباء" subtitle="عيادات الأطباء الخياليين المحفوظين على خريطة حقيقية. اختر أطباء للجولة ثم احسبها في مخطّط الجولة. لا تمثل الخريطة وجود أحد في مكان ولا أي سلوك وصف."
        action={<Link href="/smart-route" data-testid="link-map-planner" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"><RouteIcon className="h-4 w-4" />مخطّط الجولة ({tour.selectedIds.length})</Link>} />

      {tour.storageWarning && <Warn testId="text-storage-warning">تعذّر قراءة أو حفظ اختيار الجولة في هذه الجلسة؛ قد لا يبقى الاختيار بعد إعادة التحميل.</Warn>}
      {toggleMsg && <Warn testId="text-toggle-error">{toggleMsg}</Warn>}

      <Panel className="mb-4 grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">بحث بالاسم</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="field-input min-h-[44px] pr-9" placeholder="ابحث باسم الطبيب" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-map-search" />
        </label>
        <select aria-label="المنطقة" className="field-input min-h-[44px] min-w-0" value={region} onChange={(e) => setRegion(e.target.value)} data-testid="select-map-region">
          <option value="">كل المناطق</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="التخصص" className="field-input min-h-[44px] min-w-0" value={specialty} onChange={(e) => setSpecialty(e.target.value)} data-testid="select-map-specialty">
          <option value="">كل التخصصات</option>{specs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div role="group" aria-label="نطاق العرض" className="grid grid-cols-2 rounded-xl border border-border p-1">
          {(["all", "selected"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} data-testid={`toggle-map-mode-${m}`}
              className={`min-h-[40px] rounded-lg text-sm font-semibold ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{m === "all" ? "الكل" : `المحددون (${tour.selectedIds.length})`}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4" data-testid="text-map-count">على الخريطة: {located.length} · بلا موقع: {unlocated.length} · من أصل {docs.length}</p>
      </Panel>

      {q.isLoading ? <Skel className="h-[min(62dvh,620px)] min-h-[320px]" />
        : q.isError ? <ErrorState message={errMsg(q.error, "تعذّر تحميل بيانات الخريطة.")} onRetry={() => q.refetch()} testId="error-map-data" />
        : docs.length === 0 ? <EmptyState icon={<MapPinOff className="h-6 w-6" />} title="لا يوجد أطباء محفوظون" body="أضف طبيبًا بإحداثيات وأوقات استقبال ليظهر على الخريطة." action={<Link href="/doctors/new" data-testid="link-map-add-doctor" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">إضافة طبيب</Link>} />
        : (
          <div className="space-y-4">
            {focusId !== null && (!focusDoc ? <Warn testId="text-map-focus">الطبيب المطلوب (رقم {focusId}) غير موجود في السجلات الحالية.</Warn>
              : !validMapCoordinates(focusDoc) ? <Warn testId="text-map-focus">موقع «{focusDoc.name}» غير محدد بإحداثيات صالحة، لذلك لا يظهر على الخريطة.</Warn>
              : !markerIds.has(focusDoc.id) ? <Warn testId="text-map-focus">الفلاتر الحالية تخفي عيادة «{focusDoc.name}». امسح الفلاتر لإظهارها؛ لم نضف علامة خارج نطاق التصفية.</Warn>
              : <p className="text-sm text-secondary-foreground" data-testid="text-map-focus">تم تمييز عيادة «{focusDoc.name}» على الخريطة.</p>)}
            {raw !== null && focusId === null && <Warn testId="text-map-focus">رابط التركيز غير صالح.</Warn>}
            {invalidSel.length > 0 && (
              <Warn testId="text-invalid-selection">
                {invalidSel.length} من الأطباء المحددين للجولة لم يعودوا موجودين في السجلات.
                <button type="button" className="mr-2 min-h-[44px] font-bold underline" data-testid="button-remove-invalid-selection" onClick={() => setTourSelection(tour.selectedIds.filter((id) => !invalidSel.includes(id)))}>إزالتهم من الاختيار</button>
              </Warn>
            )}
            {issue && <Warn testId="text-plan-stale">{issue} <Link href="/smart-route" className="font-bold underline" data-testid="link-recalculate-plan">إعادة الحساب</Link></Warn>}
            {plan && (
              <div className="rounded-xl border border-accent/30 bg-secondary/70 p-3 text-sm text-secondary-foreground" data-testid="text-current-tour">
                الجولة الحالية: {plan.stops.length} محطة من «{plan.startPoint.name}» بدءًا من {plan.startTime}. <span data-testid="text-route-notice">{ROUTE_NOTICE}</span>
                {hiddenStops > 0 && <p className="mt-1 font-semibold" data-testid="text-route-hidden">الفلاتر الحالية تُخفي {hiddenStops} من محطات الجولة، لذلك أُخفي خط المسار كاملًا. الأرقام الظاهرة تبقى ترتيب الجولة الفعلي.</p>}
              </div>
            )}
            {located.length === 0 && <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground" data-testid="text-map-empty">لا يوجد أطباء بمواقع صالحة يطابقون الفلاتر الحالية.</p>}
            <LazyDoctorMap doctors={markers} plan={plan} showRoute={!!plan && hiddenStops === 0} selectedIds={tour.selectedIds} focusId={focusDoc && validMapCoordinates(focusDoc) && markerIds.has(focusDoc.id) ? focusDoc.id : null} onToggle={toggle} />

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="min-w-0">
                <h2 className="mb-2 font-display font-semibold text-primary">الأطباء المعروضون ({located.length})</h2>
                <ul className="max-h-80 space-y-2 overflow-y-auto" data-testid="list-map-doctors">
                  {located.map((d) => {
                    const stop = plan?.stops.find((s) => s.doctorId === d.id);
                    const hours = validMapHours(d);
                    return (
                      <li key={d.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card p-2" data-testid={`row-map-doctor-${d.id}`}>
                        {stop && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{stop.order}</span>}
                        <Link href={`/doctors/${d.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-primary" data-testid={`link-map-row-profile-${d.id}`}>{d.name} <span className="font-normal text-muted-foreground">· {d.specialty}</span></Link>
                        <button type="button" disabled={!hours && !sel.has(d.id)} title={!hours ? "أوقات الاستقبال غير محددة" : undefined} onClick={() => toggle(d.id)} data-testid={`button-row-toggle-${d.id}`}
                          className={`min-h-[44px] shrink-0 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${sel.has(d.id) ? "border border-border text-primary" : "bg-accent text-accent-foreground"}`}>{sel.has(d.id) ? "إزالة" : hours ? "إضافة" : "بلا أوقات"}</button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className="min-w-0">
                <h2 className="mb-2 font-display font-semibold text-primary">الموقع غير محدد ({unlocated.length})</h2>
                {unlocated.length === 0 ? <p className="text-sm text-muted-foreground">كل الأطباء المطابقين لهم إحداثيات صالحة.</p> : (
                  <ul className="space-y-2" data-testid="list-unlocated">
                    {unlocated.map((d) => (
                      <li key={d.id} className="rounded-xl border border-dashed border-input bg-card p-2 text-sm" data-testid={`row-unlocated-${d.id}`}>
                        <Link href={`/doctors/${d.id}`} className="font-semibold text-primary" data-testid={`link-unlocated-${d.id}`}>{d.name}</Link>
                        <p className="text-xs text-muted-foreground">الموقع غير محدد · لا يمكن إضافته للجولة حتى تُحدَّث إحداثياته من ملفه.</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
    </div>
  );
}

function Warn({ children, testId }: { children: React.ReactNode; testId: string }) {
  return <div role="status" data-testid={testId} className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1">{children}</div></div>;
}
