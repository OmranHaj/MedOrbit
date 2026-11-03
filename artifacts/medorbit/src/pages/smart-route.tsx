import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useGetSmartRouteOptions, usePlanSmartRoute, type SmartRouteInput, type SmartRoutePlan } from "@workspace/api-client-react";
import { AlertTriangle, Clock, Loader2, MapPin, Navigation, RefreshCw } from "lucide-react";
import { PageHeader, Panel, Field, Btn, ErrorState, Skel, EmptyState, Banner } from "@/components/ui-kit";
import { errMsg } from "@/lib/format";

type Errs = Partial<Record<"region" | "startPointId" | "startTime" | "visitDurationMinutes" | "travelSpeedKmh", string>>;

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function sameInput(a: SmartRouteInput | null, b: SmartRouteInput) {
  return !!a && a.region === b.region && a.startPointId === b.startPointId && a.startTime === b.startTime && a.visitDurationMinutes === b.visitDurationMinutes && a.travelSpeedKmh === b.travelSpeedKmh;
}

export default function SmartRoute() {
  const opts = useGetSmartRouteOptions();
  const m = usePlanSmartRoute();
  const [region, setRegion] = useState("");
  const [startPointId, setStartPointId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("15");
  const [speed, setSpeed] = useState("25");
  const [errs, setErrs] = useState<Errs>({});
  const [plan, setPlan] = useState<SmartRoutePlan | null>(null);
  const [planInput, setPlanInput] = useState<SmartRouteInput | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const inited = useRef(false);
  useEffect(() => {
    const title = document.title;
    const metas = [
      ["meta[name='description']", "مخطّط جولة تجريبية لأطباء خياليين وفق نوافذ استقبالهم، بمسافات وأوقات تقريبية دون حركة مرور حية."],
      ["meta[property='og:title']", "مخطّط الجولة | ميد أوربت"],
      ["meta[property='og:description']", "تقدير جشع لزيارات ممكنة مع الانتظار وأسباب الاستبعاد؛ ليس مسارًا أمثل أو ملاحة حية."],
    ].map(([selector, content]) => {
      const element = document.querySelector<HTMLMetaElement>(selector);
      const previous = element?.content;
      if (element) element.content = content;
      return { element, previous };
    });
    document.title = "مخطّط الجولة | ميد أوربت";
    return () => {
      document.title = title;
      for (const { element, previous } of metas) if (element && previous !== undefined) element.content = previous;
    };
  }, []);

  useEffect(() => {
    const d = opts.data;
    if (!d || inited.current) return;
    inited.current = true;
    setRegion(d.regions.includes(d.demoRegion) ? d.demoRegion : d.regions[0] ?? "");
    setStartPointId(d.startPoints[0]?.id ?? "");
    setDuration(String(d.defaultVisitDurationMinutes));
    setSpeed(String(d.defaultTravelSpeedKmh));
  }, [opts.data]);

  const current: SmartRouteInput = { region, startPointId, startTime, visitDurationMinutes: Number(duration), travelSpeedKmh: Number(speed) };
  const stale = !!plan && !sameInput(planInput, current);

  function validate(): Errs {
    const e: Errs = {};
    if (!region || !opts.data?.regions.includes(region)) e.region = "اختر منطقة.";
    if (!startPointId || !opts.data?.startPoints.some((s) => s.id === startPointId)) e.startPointId = "اختر نقطة انطلاق.";
    if (!TIME_RE.test(startTime)) e.startTime = "أدخل وقتاً بصيغة HH:mm.";
    const d = Number(duration);
    if (!/^\d+$/.test(duration) || d < 1 || d > 120) e.visitDurationMinutes = "عدد صحيح من 1 إلى 120 دقيقة.";
    const s = Number(speed);
    if (speed.trim() === "" || !Number.isFinite(s) || s < 1 || s > 120) e.travelSpeedKmh = "قيمة من 1 إلى 120 كم/ساعة.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    const input = { ...current };
    setSubmitErr(null);
    try {
      const res = await m.mutateAsync({ data: input });
      setPlan(res);
      setPlanInput(input);
    } catch (err) {
      setPlan(null);
      setPlanInput(null);
      setSubmitErr(errMsg(err, "تعذّر حساب الجولة."));
    }
  }

  const sp = opts.data?.startPoints.find((s) => s.id === startPointId);

  return (
    <div>
      <PageHeader eyebrow="Smart Route تجريبي" title="مخطّط الجولة" subtitle="رتّب زيارات يوم واحد لأطباء منطقة محددة وفق أوقات استقبالهم. حساب مؤقت للقراءة فقط، لا يُحفظ ولا يُنشئ أي زيارة أو تقرير." />

      <div role="note" data-testid="text-route-caveat" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="min-w-0"><strong>تقدير تقريبي:</strong> المسافات خطوط مستقيمة على سطح الأرض (صيغة Haversine)، والسرعة ثابتة كما تُدخلها، ويُقرَّب زمن التنقل إلى الدقيقة الأعلى. لا طرق ولا ازدحام مباشر ولا GPS، ولا يوجد ضمان بأن الترتيب هو الأفضل على الإطلاق. الخريطة غير معروضة عمداً. تُفقد النتيجة عند إعادة تحميل الصفحة ويجب إعادة الحساب.</p>
      </div>

      {opts.isLoading ? (
        <Panel className="space-y-4 p-5"><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-10" /><Skel className="h-11 w-40" /></Panel>
      ) : opts.isError || !opts.data ? (
        <ErrorState message={errMsg(opts.error, "تعذّر تحميل خيارات الجولة.")} onRetry={() => opts.refetch()} testId="error-route-options" />
      ) : opts.data.regions.length === 0 ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="لا يوجد أطباء محفوظون" body="أضف أطباء بمناطق وأوقات استقبال أولاً، ثم عد لتخطيط الجولة." action={<Link href="/doctors/new" data-testid="link-add-doctor" className="inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">إضافة طبيب</Link>} />
      ) : (
        <>
          <Panel className="p-5">
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label="المنطقة" htmlFor="region" error={errs.region} hint={`يُستخدم الأطباء المحفوظون في هذه المنطقة تماماً (حتى ${opts.data.maxDoctorsPerRegion} طبيب).`}>
                <select id="region" data-testid="select-region" className="field-input" value={region} onChange={(e) => setRegion(e.target.value)}>
                  {opts.data.regions.map((r) => <option key={r} value={r}>{r}{r === opts.data!.demoRegion ? " (تجريبية)" : ""}</option>)}
                </select>
              </Field>
              <Field label="نقطة الانطلاق" htmlFor="startPointId" error={errs.startPointId}>
                <select id="startPointId" data-testid="select-start-point" className="field-input" value={startPointId} onChange={(e) => setStartPointId(e.target.value)}>
                  {opts.data.startPoints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {sp && <p dir="ltr" className="text-left font-mono text-xs text-muted-foreground" data-testid="text-start-coords">{sp.latitude.toFixed(5)}, {sp.longitude.toFixed(5)}</p>}
              </Field>
              <Field label="وقت البدء (محلي، 24 ساعة)" htmlFor="startTime" error={errs.startTime}>
                <input id="startTime" data-testid="input-start-time" type="time" className="field-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
              <Field label="مدة الزيارة (دقيقة)" htmlFor="visitDurationMinutes" error={errs.visitDurationMinutes} hint="من 1 إلى 120 دقيقة.">
                <input id="visitDurationMinutes" data-testid="input-visit-duration" type="number" inputMode="numeric" min={1} max={120} step={1} className="field-input" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
              <Field label="سرعة التنقل المفترضة (كم/ساعة)" htmlFor="travelSpeedKmh" error={errs.travelSpeedKmh} hint="من 1 إلى 120 كم/ساعة.">
                <input id="travelSpeedKmh" data-testid="input-travel-speed" type="number" inputMode="decimal" min={1} max={120} step="any" className="field-input" value={speed} onChange={(e) => setSpeed(e.target.value)} />
              </Field>
              <div className="flex items-end">
                <Btn type="submit" variant="teal" disabled={m.isPending} data-testid="button-plan-route" className="w-full sm:w-auto">
                  {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                  {m.isPending ? "جارٍ الحساب..." : "احسب الجولة"}
                </Btn>
              </div>
            </form>
            <p className="mt-4 rounded-lg bg-secondary/70 p-3 text-xs leading-relaxed text-secondary-foreground" data-testid="text-compare-hint">
              للمقارنة: اختر «{opts.data.demoRegion}» واحسب الجولة بوقت بدء 09:00 ثم 11:30 ثم 16:00، ولاحظ كيف تتغيّر الزيارات الممكنة وأسباب الاستبعاد مع إغلاق نوافذ الاستقبال.
            </p>
          </Panel>

          <div className="mt-6" aria-live="polite">
            {submitErr && <Banner kind="error" onClose={() => setSubmitErr(null)}>{submitErr}</Banner>}
            {m.isPending && <Panel className="space-y-3 p-5"><Skel className="h-16" /><Skel className="h-24" /><Skel className="h-24" /></Panel>}
            {!m.isPending && plan && planInput && (
              <Results plan={plan} stale={stale} onRecalc={() => submit({ preventDefault() {} } as React.FormEvent)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-base font-bold text-primary" data-testid={testId}>{value}</div>
    </div>
  );
}

function Results({ plan, stale, onRecalc }: { plan: SmartRoutePlan; stale: boolean; onRecalc: () => void }) {
  return (
    <div className={`space-y-5 transition ${stale ? "opacity-60" : ""}`} data-testid="section-route-results">
      {stale && (
        <div role="status" data-testid="text-stale-result" className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center">
          <p className="flex-1">تغيّرت المدخلات بعد آخر حساب. النتيجة أدناه تخص المدخلات السابقة ويلزم إعادة الحساب.</p>
          <Btn variant="ghost" onClick={onRecalc} data-testid="button-recalculate"><RefreshCw className="h-4 w-4" />إعادة الحساب</Btn>
        </div>
      )}
      <Panel className="p-5">
        <p className="text-xs text-muted-foreground" data-testid="text-plan-inputs">
          {plan.region} · من {plan.startPoint.name} · بدء {plan.startTime} · زيارة {plan.visitDurationMinutes} د · سرعة {plan.travelSpeedKmh} كم/س
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="الزيارات المقترحة / الأطباء" value={`${plan.visitedDoctorCount} / ${plan.consideredDoctorCount}`} testId="text-visited-count" />
          <Stat label="المسافة التقريبية" value={`${plan.totalDistanceKm.toFixed(2)} كم`} testId="text-total-distance" />
          <Stat label="زمن التنقل" value={`${plan.totalTravelMinutes} د`} testId="text-total-travel" />
          <Stat label="الانتظار" value={`${plan.totalWaitingMinutes} د`} testId="text-total-waiting" />
          <Stat label="زمن الزيارات" value={`${plan.totalVisitMinutes} د`} testId="text-total-visit" />
          <Stat label="المدة الكلية" value={`${plan.totalDurationMinutes} د`} testId="text-total-duration" />
          <Stat label="الانتهاء التقديري" value={plan.endTime} testId="text-end-time" />
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-primary">ترتيب الزيارات الممكنة</h2>
        {plan.stops.length === 0 ? (
          <EmptyState icon={<Clock className="h-6 w-6" />} title="لا توجد زيارة ممكنة" body="لا يمكن الوصول إلى أي طبيب ضمن نافذة استقباله بهذه المدخلات. راجع أسباب الاستبعاد أدناه أو جرّب وقت بدء أبكر." />
        ) : (
          <ol className="space-y-3" data-testid="list-route-stops">
            {plan.stops.map((s) => (
              <li key={s.doctorId} data-testid={`row-stop-${s.doctorId}`}>
                <Panel className="flex min-w-0 gap-3 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{s.order}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <Link href={`/doctors/${s.doctorId}`} data-testid={`link-stop-doctor-${s.doctorId}`} className="min-w-0 break-words font-semibold text-primary hover:text-accent">{s.doctorName}</Link>
                      <span className="text-xs text-muted-foreground">الاستقبال {s.visitingStart}–{s.visitingEnd}</span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div><dt className="text-muted-foreground">الوصول</dt><dd className="font-semibold" data-testid={`text-arrival-${s.doctorId}`}>{s.arrivalTime}</dd></div>
                      <div><dt className="text-muted-foreground">بدء الزيارة</dt><dd className="font-semibold">{s.visitStartTime}</dd></div>
                      <div><dt className="text-muted-foreground">المغادرة</dt><dd className="font-semibold">{s.departureTime}</dd></div>
                      <div><dt className="text-muted-foreground">الانتظار</dt><dd className="font-semibold">{s.waitingMinutes} د</dd></div>
                      <div className="col-span-2 sm:col-span-4"><dt className="inline text-muted-foreground">المرحلة: </dt><dd className="inline">{s.distanceKm.toFixed(2)} كم تقريباً · {s.travelMinutes} د تنقل</dd></div>
                    </dl>
                    <Link href={`/visits/new?doctorId=${s.doctorId}`} data-testid={`link-stop-report-${s.doctorId}`} className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">فتح تقرير زيارة (يتطلب رمز تحقق العيادة التجريبي)</Link>
                  </div>
                </Panel>
              </li>
            ))}
          </ol>
        )}
      </section>

      {plan.omitted.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-primary">أطباء لم يدخلوا الجولة ({plan.omitted.length})</h2>
          <ul className="space-y-2" data-testid="list-route-omitted">
            {plan.omitted.map((o) => (
              <li key={o.doctorId} data-testid={`row-omitted-${o.doctorId}`} className="min-w-0 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link href={`/doctors/${o.doctorId}`} className="min-w-0 break-words font-semibold text-primary hover:text-accent" data-testid={`link-omitted-doctor-${o.doctorId}`}>{o.doctorName}</Link>
                  <span className="text-xs text-muted-foreground">الاستقبال {o.visitingStart}–{o.visitingEnd}</span>
                </div>
                <p className="mt-1 text-destructive" data-testid={`text-omitted-reason-${o.doctorId}`}>{o.reason}</p>
                {(o.estimatedArrivalTime || o.estimatedDepartureTime) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">تقدير: وصول {o.estimatedArrivalTime ?? "—"} · مغادرة {o.estimatedDepartureTime ?? "—"}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Panel className="p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-primary">طريقة الحساب</p>
        <p className="mt-1" data-testid="text-plan-method">{plan.method}</p>
        <ul className="mt-2 list-disc space-y-1 pr-5" data-testid="list-plan-assumptions">
          {plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </Panel>
    </div>
  );
}
