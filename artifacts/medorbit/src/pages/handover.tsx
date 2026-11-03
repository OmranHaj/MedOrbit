import { useState } from "react";
import { ArrowLeftRight, MapPinned } from "lucide-react";
import type { HandoverState } from "@workspace/api-client-react";
import { PageHeader, Panel, Skel, ErrorState, EmptyState, Btn, Banner } from "@/components/ui-kit";
import { DemoDisclaimer, DemoViewSwitcher, HandoverDoctorCard, HistoryList } from "@/components/handover-kit";
import { VisitCard } from "@/components/visit-row";
import { useHandoverState, useRegionSummary, useTransfer, useHandoverInvalidate } from "@/hooks/use-handover";
import { errMsg, fmtNum } from "@/lib/format";

export default function Handover() {
  const st = useHandoverState();
  const [region, setRegion] = useState("");
  return (
    <div>
      <PageHeader eyebrow="محاكاة مشرف" title="تسليم المنطقة" subtitle="أسند منطقة غير مُسندة أو انقلها من مندوبها الحالي إلى مندوب جديد، مع ملخص الأطباء المتأثرين من السجلات المحفوظة." />
      <DemoDisclaimer />
      {st.isLoading ? <Skel className="h-40" /> : st.isError || !st.data ? <ErrorState onRetry={() => st.refetch()} /> : (
        <>
          <DemoViewSwitcher state={st.data} />
          {st.data.regions.length === 0 ? (
            <EmptyState icon={<MapPinned className="h-6 w-6" />} title="لا توجد مناطق" body="لم يُرجع الخادم أي منطقة قابلة للتسليم." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
              <div className="space-y-5">
                <Panel className="p-4">
                  <label htmlFor="region" className="block text-sm font-semibold text-primary">المنطقة</label>
                  <select id="region" className="field-input mt-1.5" value={region} onChange={(e) => setRegion(e.target.value)} data-testid="select-region">
                    <option value="">اختر منطقة</option>
                    {st.data.regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {region && (st.data.demoRepresentativeId === null
                    ? <TransferForm key={region} region={region} state={st.data} />
                    : <p className="mt-3 text-sm text-muted-foreground">بدّل إلى منظور المشرف التجريبي لإسناد المنطقة أو نقلها. هذا الفصل في الواجهة محاكاة وليس حماية صلاحيات.</p>)}
                </Panel>
                {region && <RegionSummary key={region} region={region} />}
              </div>
              <Panel className="h-fit p-4">
                <h2 className="mb-3 font-display font-semibold text-primary">سجل التسليم المحفوظ</h2>
                <HistoryList history={st.data.history} />
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TransferForm({ region, state }: { region: string; state: HandoverState }) {
  const a = state.assignments.find((x) => x.region === region) ?? null;
  const [toRep, setToRep] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const m = useTransfer();
  const inv = useHandoverInvalidate();
  const candidates = state.representatives.filter((r) => r.id !== a?.representativeId);

  const submit = () => {
    if (!toRep) return;
    setMsg(null);
    m.mutate(
      { data: { region, fromRepresentativeId: a?.representativeId ?? null, toRepresentativeId: Number(toRep), expectedVersion: a?.version ?? 0 } },
      {
        onSuccess: (res) => { setMsg({ kind: "success", text: `تم حفظ التسليم: ${res.region} الآن لدى ${res.representativeName} (نسخة ${res.version}).` }); setToRep(""); },
        onError: (e) => {
          const status = (e as { status?: number })?.status;
          if (status === 409) { setMsg({ kind: "error", text: "تغيّر إسناد هذه المنطقة من طرف آخر قبل الحفظ. تم تحديث البيانات، راجع المالك الحالي ثم أعد المحاولة يدوياً." }); void inv(); }
          else setMsg({ kind: "error", text: errMsg(e, "تعذّر حفظ التسليم.") });
        },
      },
    );
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl bg-muted/60 p-3 text-sm" data-testid="text-outgoing">
        <span className="text-muted-foreground">المندوب الحالي (المُسلِّم): </span>
        <strong className="text-primary">{a ? `${a.representativeName} · نسخة ${a.version}` : "غير مُسندة (إسناد أوّلي)"}</strong>
      </div>
      {msg && <Banner kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Banner>}
      {state.representatives.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد مندوبون متاحون.</p> : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="field-input" value={toRep} onChange={(e) => setToRep(e.target.value)} data-testid="select-to-rep" aria-label="المندوب المستلم">
            <option value="">اختر المندوب المستلم</option>
            {candidates.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <Btn variant="teal" disabled={!toRep || m.isPending} onClick={submit} data-testid="button-assign">
            <ArrowLeftRight className="h-4 w-4" />{m.isPending ? "جارٍ الحفظ..." : a ? "نقل المنطقة" : "إسناد المنطقة"}
          </Btn>
        </div>
      )}
    </div>
  );
}

function RegionSummary({ region }: { region: string }) {
  const q = useRegionSummary(region);
  if (q.isLoading) return <Skel className="h-60" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const s = q.data;
  return (
    <section className="space-y-4" data-testid="section-region-summary">
      <div className="grid grid-cols-2 gap-3">
        <Panel className="p-4"><p className="text-xs text-muted-foreground">الأطباء المتأثرون</p><p className="num font-display text-2xl font-bold text-primary" data-testid="text-doctor-count">{fmtNum(s.doctorCount)}</p></Panel>
        <Panel className="p-4"><p className="text-xs text-muted-foreground">الزيارات المحفوظة</p><p className="num font-display text-2xl font-bold text-primary" data-testid="text-visit-count">{fmtNum(s.visitCount)}</p></Panel>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="text-summary-notice">{s.notice} (حد التقارير لكل طبيب: {fmtNum(s.reportLimit)})</p>
      {s.doctors.length === 0 ? <EmptyState icon={<MapPinned className="h-6 w-6" />} title="لا يوجد أطباء" body="لا توجد سجلات أطباء محفوظة في هذه المنطقة." /> : (
        <div className="space-y-3">{s.doctors.map((d) => <HandoverDoctorCard key={d.doctor.id} d={d} />)}</div>
      )}
      {s.recentVisits.length > 0 && (
        <div className="space-y-2"><h3 className="font-display font-semibold text-primary">أحدث الزيارات في المنطقة</h3>{s.recentVisits.map((v) => <VisitCard key={v.id} v={v} />)}</div>
      )}
    </section>
  );
}
