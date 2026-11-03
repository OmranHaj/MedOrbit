import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetDoctorBriefing, getGetDoctorBriefingQueryKey } from "@workspace/api-client-react";
import type { BriefingCitation } from "@workspace/api-client-react";
import { ChevronDown, ChevronUp, ClipboardCheck, RotateCw, ListChecks, Package, BookOpen, History, ArrowLeftRight, Info, ShieldCheck } from "lucide-react";
import { Panel, Skel, ErrorState, Btn, OutcomeBadge } from "@/components/ui-kit";
import { fmtDate, fmtNum } from "@/lib/format";

function Cite({ c, group }: { c: BriefingCitation; group: string }) {
  const confirmed = c.verificationStatus === "Confirmed by clinic demo code";
  return (
    <a href={`#visit-${c.visitId}`} data-testid={`source-visit-${c.visitId}`} data-group={group}
      className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-secondary">
      <span className="num">زيارة #{fmtNum(c.visitId)}</span><span>·</span><span className="num">{fmtDate(c.date)}</span>
       <span className={confirmed ? "text-teal-800" : "text-muted-foreground"}>· {confirmed ? "مؤكَّدة برمز العيادة التجريبي" : "تقرير سابق غير مُتحقَّق منه"}</span>
    </a>
  );
}

function Cites({ list, group }: { list: BriefingCitation[]; group: string }) {
  if (!list.length) return null;
  return <div className="mt-1.5 flex flex-wrap gap-1.5">{list.map((c, i) => <Cite key={`${c.visitId}-${i}`} c={c} group={group} />)}</div>;
}

function Excerpt({ c }: { c: BriefingCitation }) {
  if (!c.excerpt) return null;
  return <blockquote className="mt-1 break-words border-s-2 border-accent/50 ps-2 text-xs text-muted-foreground">«{c.excerpt}»</blockquote>;
}

function Sec({ icon, title, note, children, testId }: { icon: ReactNode; title: string; note?: string; children: ReactNode; testId: string }) {
  return (
    <div className="border-t border-border pt-4" data-testid={testId}>
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-primary"><span className="text-accent">{icon}</span>{title}</h3>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

const None = ({ t }: { t: string }) => <p className="text-xs text-muted-foreground">{t}</p>;

export function DoctorBriefing({ doctorId }: { doctorId: number }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const q = useGetDoctorBriefing(doctorId, { query: { enabled: open, queryKey: getGetDoctorBriefingQueryKey(doctorId), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const b = q.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: getGetDoctorBriefingQueryKey(doctorId) }); };

  return (
    <section className="mt-6" data-testid="section-doctor-briefing">
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant={open ? "ghost" : "teal"} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="button-prepare-visit">
          <ClipboardCheck className="h-4 w-4" />حضّرني للزيارة{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Btn>
        {open && <Btn variant="ghost" onClick={refresh} disabled={q.isFetching} data-testid="button-refresh-briefing"><RotateCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />تحديث الملخص</Btn>}
      </div>

      {open && (
        <Panel className="rise mt-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground" data-testid="text-briefing-label">ملخص آلي منظّم</span>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground" data-testid="text-briefing-no-ai">دون ذكاء اصطناعي توليدي</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">يُبنى هذا الملخص على الخادم بقواعد ثابتة من التقارير المحفوظة وملف الطبيب، دون نموذج توليدي. اقتراحات المتابعة قوالب مهنية معلنة وليست وقائع أو تفضيلات جديدة.</p>

          {q.isLoading ? <div className="mt-4 space-y-3"><Skel className="h-6 w-1/2" /><Skel className="h-20" /><Skel className="h-20" /></div>
            : q.isError || !b ? <div className="mt-4"><ErrorState testId="error-briefing" message="تعذّر تجهيز ملخص الزيارة." onRetry={() => q.refetch()} /></div>
            : (
              <div className="mt-4 space-y-4 break-words">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="text-briefing-counts">
                  <span>رُوجعت <span className="num font-semibold text-primary">{fmtNum(b.reviewedVisitCount)}</span> من <span className="num font-semibold text-primary">{fmtNum(b.totalVisitCount)}</span> تقرير</span>
                  {b.privacyOmittedVisitCount > 0 && <span className="inline-flex items-center gap-1" data-testid="text-briefing-privacy"><ShieldCheck className="h-3.5 w-3.5" />حُجبت ملاحظات <span className="num">{fmtNum(b.privacyOmittedVisitCount)}</span> تقرير لأسباب الخصوصية</span>}
                  <span>أُنشئ في <span className="num">{fmtDate(b.generatedAt)}</span></span>
                </div>

                <Sec icon={<History className="h-4 w-4" />} title="آخر الزيارات" note="النتيجة كما سُجّلت في التقرير وقتها، وليست تفضيلًا دائمًا للطبيب." testId="briefing-timeline">
                  {!b.timeline.length ? <None t="لا توجد تقارير زيارة مسجّلة لهذا الطبيب بعد." /> : (
                    <ol className="space-y-3">{b.timeline.map((t) => (
                      <li key={t.visitId} className="rounded-xl bg-muted/40 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-primary">{t.productName}</span><OutcomeBadge outcome={t.outcome} /></div>
                        {t.notesWithheld ? <p className="mt-1 text-xs text-muted-foreground">الملاحظات محجوبة لأسباب الخصوصية.</p>
                          : t.notesExcerpt ? <blockquote className="mt-1 border-s-2 border-accent/50 ps-2 text-xs text-muted-foreground">«{t.notesExcerpt}»</blockquote> : null}
                        <Cites list={[t.citation]} group="timeline" />
                      </li>))}</ol>)}
                </Sec>

                <Sec icon={<Package className="h-4 w-4" />} title="المنتجات التي نوقشت" testId="briefing-products">
                  {!b.productsDiscussed.length ? <None t="لا منتجات مسجّلة في التقارير." /> : (
                    <ul className="space-y-2">{b.productsDiscussed.map((p) => (
                      <li key={p.productId}><span className="text-sm font-semibold text-primary">{p.productName}</span> <span className="num text-xs text-muted-foreground">({fmtNum(p.recordCount)} تقرير)</span><Cites list={p.citations} group={`product-${p.productId}`} /></li>))}</ul>)}
                </Sec>

                <Sec icon={<BookOpen className="h-4 w-4" />} title="الاهتمامات العلمية المعلنة" note={`المصدر: حقل الاهتمامات العلمية في ملف الطبيب، المُنشأ في ${fmtDate(b.declaredScientificInterests.profileCreatedAt)}.`} testId="briefing-interests">
                  {b.declaredScientificInterests.text ? <p className="whitespace-pre-wrap text-sm">{b.declaredScientificInterests.text}</p> : <None t="لا يوجد نص اهتمامات قابل للعرض في هذا الملخص." />}
                  {b.declaredScientificInterests.visitCitations.length ? <>
                    <p className="mt-2 text-xs text-muted-foreground">ذُكرت حرفيًا في ملاحظات التقارير التالية:</p>
                    {b.declaredScientificInterests.visitCitations.map((c, i) => <div key={i}><Excerpt c={c} /><Cites list={[c]} group="interests" /></div>)}
                  </> : <p className="mt-2 text-xs text-muted-foreground">{b.declaredScientificInterests.notice}</p>}
                </Sec>

                <Sec icon={<ListChecks className="h-4 w-4" />} title="الطلبات المعلّقة — تحتاج تأكيد الحالة" note="لا توجد حالة إنجاز منظّمة؛ هذه مقتطفات طلبات كما سُجّلت حرفيًا، وليست دليلًا على أنها ما زالت قائمة." testId="briefing-requests">
                  {!b.outstandingRequests.length ? <None t="لا مقتطفات طلبات في التقارير المراجعة." /> : (
                    <ul className="space-y-3">{b.outstandingRequests.map((r, i) => (
                      <li key={i} className="rounded-xl bg-muted/40 p-3"><p className="text-sm">«{r.quote}»</p><p className="mt-1 text-xs text-muted-foreground">{r.notice}</p><Cites list={r.citations} group={`request-${i}`} /></li>))}</ul>)}
                </Sec>

                <Sec icon={<ArrowLeftRight className="h-4 w-4" />} title="متابعة مهنية مقترحة" note="إجراءات مقترحة بالقواعد للمندوب، وليست طلبات من الطبيب ولا مواعيد مؤكَّدة." testId="briefing-followup">
                  {!b.suggestedFollowUp.length ? <None t="لا اقتراحات متابعة؛ لا تقارير كافية." /> : (
                    <ul className="space-y-2">{b.suggestedFollowUp.map((f, i) => <li key={i}><p className="text-sm">{f.text}</p><Cites list={f.citations} group={`followup-${i}`} /></li>)}</ul>)}
                </Sec>

                {b.limitations.length > 0 && (
                  <div className="flex gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground" data-testid="briefing-limitations">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" /><ul className="list-disc space-y-1 ps-4">{b.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </div>)}
              </div>)}
        </Panel>
      )}
    </section>
  );
}
