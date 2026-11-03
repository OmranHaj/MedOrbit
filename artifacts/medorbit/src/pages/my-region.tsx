import { MapPinned, UserRound } from "lucide-react";
import { PageHeader, Panel, Skel, ErrorState, EmptyState, LinkBtn } from "@/components/ui-kit";
import { DemoDisclaimer, DemoViewSwitcher, HandoverDoctorCard, HistoryList } from "@/components/handover-kit";
import { useHandoverState, useMyDoctors } from "@/hooks/use-handover";
import { fmtNum } from "@/lib/format";

export default function MyRegion() {
  const st = useHandoverState();
  const repId = st.data?.demoRepresentativeId ?? null;
  const mine = useMyDoctors(repId);
  return (
    <div>
      <PageHeader eyebrow="عرض المندوب" title="منطقتي" subtitle="المناطق المُسندة إليك في العرض التجريبي، وسجل تسليمها، وطلبات الأطباء المذكورة في التقارير المحفوظة." />
      <DemoDisclaimer />
      {st.isLoading ? <Skel className="h-40" /> : st.isError || !st.data ? <ErrorState onRetry={() => st.refetch()} /> : (
        <>
          <DemoViewSwitcher state={st.data} />
          {repId === null ? (
            <EmptyState icon={<UserRound className="h-6 w-6" />} title="أنت في عرض المشرف" body="اختر مندوباً من مبدّل العرض أعلاه لرؤية مناطقه." action={<LinkBtn href="/handover" variant="ghost" testId="link-go-handover">إلى تسليم المنطقة</LinkBtn>} />
          ) : (
            <div className="space-y-6">
              <Panel className="p-4">
                <h2 className="mb-3 font-display font-semibold text-primary">سجل تسليم مناطقي</h2>
                <HistoryList testId="list-my-history" history={st.data.history.filter((h) => h.toRepresentativeId === repId || h.fromRepresentativeId === repId)} />
              </Panel>
              {mine.isLoading ? <Skel className="h-60" /> : mine.isError || !mine.data ? <ErrorState onRetry={() => mine.refetch()} /> :
                mine.data.length === 0 ? <EmptyState icon={<MapPinned className="h-6 w-6" />} title="لا توجد مناطق مُسندة" body="لم يُسند المشرف أي منطقة لهذا المندوب بعد." /> : (
                  mine.data.map((s) => (
                    <section key={s.region} className="space-y-3" data-testid={`section-my-region-${s.region}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-display text-xl font-bold text-primary">{s.region}</h2>
                        <p className="num text-xs text-muted-foreground" data-testid="text-my-summary">{fmtNum(s.doctorCount)} طبيب · {fmtNum(s.visitCount)} زيارة محفوظة{s.assignment ? ` · نسخة ${s.assignment.version}` : ""}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.notice}</p>
                      {s.doctors.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد أطباء في هذه المنطقة.</p> :
                        s.doctors.map((d) => <HandoverDoctorCard key={d.doctor.id} d={d} />)}
                    </section>
                  ))
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
