import { useState } from "react";
import { Link } from "wouter";
import { getListClinicDemoVisitsQueryKey, useListClinicDemoVisits, useListDoctors, useStartClinicDemoSession, type ClinicDemoVisit, type DemoSession } from "@workspace/api-client-react";
import { ArrowRight, Loader2, MonitorSmartphone, PlayCircle, ShieldAlert } from "lucide-react";
import { Btn, Banner, EmptyState, ErrorState, Panel, Skel } from "@/components/ui-kit";
import { Logo } from "@/components/shell";
import { errMsg } from "@/lib/format";
import { fmtClock, shortRef, useCountdown } from "@/lib/otp";

function CodeRow({ v }: { v: ClinicDemoVisit }) {
  const left = useCountdown(v.expiresAt, v.serverTime);
  return (
    <article className="rise flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`card-clinic-visit-${v.id}`}>
      <div className="text-sm">
        <div className="font-display font-semibold text-primary">{v.doctorName}</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>مرجع <span className="num font-mono">{shortRef(v.id)}</span></span>
          <span>المندوب: {v.representativeLabel} (<span className="font-mono">{v.representativeId.slice(0, 8)}</span>)</span>
          <span>تنتهي خلال <span className="num">{fmtClock(left)}</span></span>
        </div>
      </div>
      <div dir="ltr" className="select-all rounded-xl bg-primary px-5 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.35em] text-primary-foreground" data-testid={`text-code-${v.id}`}>{v.code}</div>
    </article>
  );
}

export default function ClinicDemo() {
  const sessionM = useStartClinicDemoSession();
  const doctors = useListDoctors();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [sessErr, setSessErr] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const params = doctorId ? { doctorId: Number(doctorId) } : undefined;
  const list = useListClinicDemoVisits(params, { query: { enabled: !!session, queryKey: getListClinicDemoVisitsQueryKey(params), refetchInterval: 3000, refetchIntervalInBackground: true, staleTime: 0 } });
  const start = async () => {
    setSessErr(null);
    try { setSession(await sessionM.mutateAsync()); } catch (e) { setSessErr(errMsg(e, "تعذّر بدء محاكاة السكرتير.")); }
  };
  const active = (list.data ?? []).filter((v) => v.status === "pending");

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3"><Logo /><Link href="/visits/new" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline" data-testid="link-back-rep"><ArrowRight className="h-4 w-4" />العودة إلى نموذج المندوب</Link></div></header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div className="rise">
          <p className="mb-1 text-xs font-semibold tracking-wide text-accent" dir="ltr" data-testid="text-sim-name">Clinic Demo Simulator — DEMO</p>
          <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl" data-testid="text-page-title">محاكي سكرتير العيادة</h1>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900" data-testid="text-demo-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>صفحة تجريبية فقط:</strong> لا تُرسل أي رسائل، والرمز لا يثبت الحضور الفعلي للمندوب. يمكن لأي شخص تفعيل هذا المحاكي؛ فهو ليس دوراً محمياً لعيادة حقيقية.</p>
        </div>
        <Panel className="p-5">
          <h2 className="mb-2 flex items-center gap-2 font-display font-semibold text-primary"><MonitorSmartphone className="h-4 w-4 text-accent" />طريقة العرض بشاشتين</h2>
          <ol className="list-decimal space-y-1 pe-1 ps-5 text-sm text-muted-foreground">
            <li>الشاشة 1: افتح <span dir="ltr" className="font-mono">/visits/new</span> وابدأ زيارة معلّقة للطبيب.</li>
            <li>الشاشة 2: هذه الصفحة <span dir="ltr" className="font-mono">/clinic-demo</span> بعد بدء المحاكاة.</li>
            <li>انقل الرمز يدوياً إلى المندوب ليدخله في نموذجه. لا يوجد نسخ أو تعبئة تلقائية.</li>
          </ol>
        </Panel>
        {!session ? (
          <div className="space-y-3">
            {sessErr && <Banner kind="error">{sessErr}</Banner>}
            <Btn variant="teal" onClick={start} disabled={sessionM.isPending} data-testid="button-start-clinic">{sessionM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}{sessErr ? "إعادة المحاولة" : "بدء محاكاة السكرتير"}</Btn>
          </div>
        ) : (
          <Panel className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-xs text-muted-foreground" data-testid="text-clinic-session">جلسة المحاكي: {session.label} · تحديث كل 3 ثوانٍ</p>
              <div className="space-y-1.5 sm:w-64">
                <label htmlFor="filterDoctor" className="block text-sm font-semibold text-primary">تصفية حسب الطبيب</label>
                <select id="filterDoctor" className="field-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} data-testid="select-filter-doctor" disabled={!doctors.data}>
                  <option value="">كل الأطباء</option>
                  {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {doctors.isError && <ErrorState message="تعذّر تحميل قائمة الأطباء." onRetry={() => doctors.refetch()} testId="error-doctors" />}
            {list.isLoading ? <div className="space-y-3"><Skel className="h-20" /><Skel className="h-20" /></div>
              : list.isError ? <ErrorState message={errMsg(list.error, "تعذّر تحميل الزيارات المعلّقة.")} onRetry={() => (/(401|403)/.test(String((list.error as { status?: number })?.status)) ? start() : list.refetch())} testId="error-clinic-list" />
              : active.length === 0 ? <EmptyState icon={<MonitorSmartphone className="h-5 w-5" />} title="لا توجد زيارات بانتظار رمز" body="عندما يبدأ مندوب زيارة معلّقة سيظهر الرمز هنا. تختفي الرموز بعد التأكيد أو القفل أو انتهاء 5 دقائق." />
              : <div className="space-y-3">{active.map((v) => <CodeRow key={v.id} v={v} />)}</div>}
          </Panel>
        )}
      </main>
    </div>
  );
}
