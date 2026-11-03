import { useState } from "react";
import { Link } from "wouter";
import type { HandoverDoctor, HandoverState } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeftRight, Eye, FileWarning, ShieldAlert, Stethoscope } from "lucide-react";
import { Btn } from "@/components/ui-kit";
import { errMsg, fmtDate } from "@/lib/format";
import { useSwitchView } from "@/hooks/use-handover";

export function DemoDisclaimer() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900" data-testid="text-handover-disclaimer">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong>عرض محاكاة عام، ليس صلاحيات حقيقية:</strong> اختيار المشرف أو المندوب هنا مجرد عرض تجريبي بلا تسجيل دخول، وليس نظام صلاحيات إنتاجي. صفحات الأطباء والملفات والتقارير تبقى دليلاً خيالياً عاماً للجميع، أما العرض المحصور بالمندوب فهو في صفحة «منطقتي» فقط.
      </p>
    </div>
  );
}

export function DemoViewSwitcher({ state }: { state: HandoverState }) {
  const current = state.demoRepresentativeId;
  const [choice, setChoice] = useState<string>(current === null ? "" : String(current));
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { switchTo, isPending } = useSwitchView();
  const currentName = current === null ? "المشرف (عرض عام)" : state.representatives.find((r) => r.id === current)?.name ?? `مندوب #${current}`;
  const target = choice === "" ? null : Number(choice);
  const changed = target !== current;

  const doSwitch = async () => {
    setErr(null);
    try {
      await switchTo(target);
      setConfirming(false);
    } catch (e) {
      setErr(errMsg(e, "تعذّر تبديل العرض. لم يتغيّر العرض الحالي."));
      setChoice(current === null ? "" : String(current));
      setConfirming(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-card-border bg-card p-4" data-testid="panel-demo-view">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Eye className="h-4 w-4 text-accent" />
        <span className="text-muted-foreground">العرض الحالي:</span>
        <strong className="text-primary" data-testid="text-current-view">{currentName}</strong>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select className="field-input sm:max-w-xs" value={choice} disabled={isPending} data-testid="select-demo-view"
          aria-label="اختيار العرض التجريبي" onChange={(e) => { setChoice(e.target.value); setConfirming(false); }}>
          <option value="">المشرف (عرض عام)</option>
          {state.representatives.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {!confirming && <Btn variant="ghost" disabled={!changed || isPending} onClick={() => setConfirming(true)} data-testid="button-switch-view">تبديل العرض</Btn>}
      </div>
      {confirming && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-900" data-testid="confirm-switch-view">
          <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />أي زيارة معلّقة لم تُرسل بعد لن تُنقل ولن تُستعاد تلقائياً بعد التبديل. التقارير المحفوظة تبقى كما هي.</p>
          <div className="mt-3 flex gap-2">
            <Btn variant="teal" disabled={isPending} onClick={doSwitch} data-testid="button-confirm-switch">{isPending ? "جارٍ التبديل..." : "تأكيد التبديل"}</Btn>
            <Btn variant="ghost" disabled={isPending} onClick={() => { setConfirming(false); setChoice(current === null ? "" : String(current)); }} data-testid="button-cancel-switch">إلغاء</Btn>
          </div>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-xs font-medium text-destructive" data-testid="error-switch-view">{err}</p>}
    </div>
  );
}

export function HandoverDoctorCard({ d }: { d: HandoverDoctor }) {
  const b = d.briefing;
  const interests = b.declaredScientificInterests;
  return (
    <article className="rounded-xl border border-border bg-card p-4" data-testid={`card-handover-doctor-${d.doctor.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/doctors/${d.doctor.id}`} className="inline-flex items-center gap-1.5 font-display font-semibold text-primary hover:text-accent" data-testid={`link-handover-doctor-${d.doctor.id}`}>
            <Stethoscope className="h-4 w-4" />{d.doctor.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">{d.doctor.specialty} · {d.doctor.region}</p>
        </div>
        <span className="num rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{b.totalVisitCount} زيارة محفوظة</span>
      </div>

      <div className="mt-3 text-sm">
        <p className="text-xs font-semibold text-accent">الاهتمامات العلمية المُعلنة في الملف</p>
        <p className="mt-1 text-foreground/85">{interests.text ?? "غير مُسجّلة"}</p>
      </div>

      {b.timeline.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-accent">أحدث الزيارات</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {b.timeline.slice(0, 3).map((t) => <li key={t.visitId}>{fmtDate(t.date)} · {t.productName} · {t.outcome}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-semibold text-accent">طلبات مذكورة في التقارير</p>
        {b.outstandingRequests.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">لا توجد طلبات مذكورة.</p> : (
          <ul className="mt-1 space-y-2">
            {b.outstandingRequests.map((r, i) => (
              <li key={i} className="rounded-lg bg-muted/60 p-2 text-xs" data-testid={`text-request-${d.doctor.id}-${i}`}>
                <p className="text-foreground/90">«{r.quote}»</p>
                <p className="mt-1 text-muted-foreground">المصدر: {r.citations.map((c) => `تقرير #${c.visitId} بتاريخ ${fmtDate(c.date)}`).join("، ")}</p>
                <p className="mt-1 text-amber-800">حالة الإنجاز غير معروفة: النظام لا يتتبع تنفيذ الطلبات.</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {d.missingFields.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive" data-testid={`text-missing-${d.doctor.id}`}>
          <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />حقول ناقصة: {d.missingFields.join("، ")}
        </div>
      )}
    </article>
  );
}

export function HistoryList({ history, testId = "list-history" }: { history: HandoverState["history"]; testId?: string }) {
  if (history.length === 0) return <p className="text-sm text-muted-foreground" data-testid={`${testId}-empty`}>لا يوجد سجل تسليم بعد.</p>;
  return (
    <ol className="space-y-2" data-testid={testId}>
      {[...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((h) => (
        <li key={h.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm" data-testid={`row-history-${h.id}`}>
          <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="font-semibold text-primary">{h.region}</p>
            <p className="text-xs text-muted-foreground">من {h.fromRepresentativeName ?? "غير مُسندة"} إلى {h.toRepresentativeName} · نسخة {h.version} · {fmtDate(h.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
