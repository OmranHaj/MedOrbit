import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { ClipboardList, Plus, Stethoscope, Users, CalendarCheck, Sparkles, Package, BarChart3, AlertTriangle } from "lucide-react";
import { PageHeader, Panel, Skel, ErrorState, EmptyState, LinkBtn, PrivacyNote } from "@/components/ui-kit";
import { VisitCard } from "@/components/visit-row";
import { fmtNum, OUTCOMES } from "@/lib/format";

export default function Dashboard() {
  const q = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const d = q.data;
  const month = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <PageHeader eyebrow="نظرة عامة" title="لوحة الشركة" subtitle="أرقام محسوبة مباشرة من السجلات المحفوظة في التطبيق، بلا أي تقديرات." action={<LinkBtn href="/visits/new" variant="teal" testId="link-dashboard-new-visit"><Plus className="h-4 w-4" />تسجيل زيارة</LinkBtn>} />
      <div className="mb-6"><PrivacyNote /></div>
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-28" />)}</div>
      ) : q.isError || !d ? (
        <ErrorState onRetry={() => q.refetch()} message="تعذّر تحميل لوحة الشركة." />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat hero label="إجمالي الزيارات" value={d.visitCount} icon={<ClipboardList className="h-4 w-4" />} id="visits" />
            <Stat label={`زيارات ${month}`} value={d.monthVisitCount} icon={<CalendarCheck className="h-4 w-4" />} id="month" />
            <Stat label="نتائج «مهتم»" value={d.interestedCount} icon={<Sparkles className="h-4 w-4" />} id="interested" />
            <Stat label="الأطباء المسجلون" value={d.doctorCount} icon={<Stethoscope className="h-4 w-4" />} id="doctors" />
            <Stat label="أطباء تمت زيارتهم" value={d.visitedDoctorCount} sub={`من ${fmtNum(d.doctorCount)}`} icon={<Users className="h-4 w-4" />} id="visited" />
            <Stat label="المنتجات في الكتالوج" value={d.productCount} icon={<Package className="h-4 w-4" />} id="products" />
          </div>

          <Panel className="p-5" >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-display font-semibold text-primary"><BarChart3 className="h-4 w-4 text-accent" />مؤشرات الصيدليات (تجميعية خيالية)</h2>
                <div className="mt-3 flex flex-wrap gap-6">
                  <div><div className="text-xs text-muted-foreground">السجلات الإقليمية المحفوظة</div><div className="num font-display text-2xl font-bold text-primary" data-testid="stat-pharmacy-observations">{fmtNum(d.pharmacyObservationCount)}</div></div>
                  <div><div className="text-xs text-muted-foreground">سجلات «غير متوفر» عبر كل الأشهر</div><div className="num font-display text-2xl font-bold text-primary" data-testid="stat-pharmacy-unavailable">{fmtNum(d.pharmacyUnavailableCount)}</div></div>
                </div>
              </div>
              <LinkBtn href="/pharmacy-insights" variant="ghost" testId="link-dashboard-pharmacy">إدخال ومقارنة</LinkBtn>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900" data-testid="text-dashboard-pharmacy-disclaimer"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />المبيعات الإقليمية لا تثبت سلوك وصف أي طبيب بعينه، ولا تُستخدم لتقييم الأطباء. هذه أعداد سجلات وليست مجموع مبيعات، ولا تمثل حالة توفر حالية.</p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel className="p-5 lg:col-span-2">
              <h2 className="font-display font-semibold text-primary">نتائج الزيارات</h2>
              <ul className="mt-4 space-y-3">
                {OUTCOMES.map((o) => {
                  const c = d.outcomes.find((x) => x.label === o)?.count ?? 0;
                  const pct = d.visitCount ? (c / d.visitCount) * 100 : 0;
                  return (
                    <li key={o} data-testid={`row-outcome-${o}`}>
                      <div className="mb-1 flex justify-between text-sm"><span>{o}</span><span className="num font-semibold">{fmtNum(c)}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full origin-right rounded-full ring-0 ${BAR[o]}`} style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
              <h2 className="mt-7 font-display font-semibold text-primary">الأطباء حسب المنطقة</h2>
              {d.regions.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">لا توجد مناطق بعد.</p> : (
                <ul className="mt-3 divide-y divide-border">
                  {d.regions.map((r) => (
                    <li key={r.label} className="flex justify-between py-2 text-sm" data-testid={`row-region-${r.label}`}><span>{r.label}</span><span className="num rounded-md bg-secondary px-2 font-semibold text-secondary-foreground">{fmtNum(r.count)}</span></li>
                  ))}
                </ul>
              )}
            </Panel>
            <div className="lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display font-semibold text-primary">أحدث الزيارات</h2>
                {d.recentVisits.length > 0 && <LinkBtn href="/visits" variant="ghost" testId="link-all-visits">كل التقارير</LinkBtn>}
              </div>
              {d.recentVisits.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="لا توجد زيارات مسجلة بعد" body="ستظهر هنا آخر تقاريرك فور حفظ أول زيارة. كل الأرقام أعلاه تبدأ من الصفر." action={<LinkBtn href="/visits/new" variant="teal" testId="link-empty-new-visit"><Plus className="h-4 w-4" />سجّل أول زيارة</LinkBtn>} />
              ) : (
                <div className="space-y-3">{d.recentVisits.map((v) => <VisitCard key={v.id} v={v} />)}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, icon, sub, hero, id }: { label: string; value: number; icon: React.ReactNode; sub?: string; hero?: boolean; id: string }) {
  return (
    <div className={`rise rounded-2xl border p-4 sm:p-5 ${hero ? "border-primary bg-primary text-primary-foreground" : "border-card-border bg-card"}`}>
      <div className={`flex items-center gap-2 text-xs font-medium ${hero ? "text-primary-foreground/70" : "text-muted-foreground"}`}><span className={hero ? "text-[hsl(173_62%_55%)]" : "text-accent"}>{icon}</span>{label}</div>
      <div className="mt-2 flex items-baseline gap-2"><span className="num font-display text-3xl font-bold" data-testid={`stat-${id}`}>{fmtNum(value)}</span>{sub && <span className="text-xs opacity-70">{sub}</span>}</div>
    </div>
  );
}

const BAR: Record<string, string> = { "مهتم": "bg-teal-500", "متابعة لاحقة": "bg-amber-500", "غير مهتم": "bg-rose-500", "لم تتم الزيارة": "bg-slate-400" };
