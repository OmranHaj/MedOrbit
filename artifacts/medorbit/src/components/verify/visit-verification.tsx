import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListPendingVisitsQueryKey, useListPendingVisits, useStartPendingVisit, useStartRepresentativeSession, useVerifyPendingVisit, type DemoSession } from "@workspace/api-client-react";
import { BadgeCheck, ExternalLink, KeyRound, Loader2, PlayCircle, RotateCw, ShieldAlert, UserRound } from "lucide-react";
import { Btn, Banner, Skel, ErrorState } from "@/components/ui-kit";
import { errMsg } from "@/lib/format";
import { fmtClock, normalizeDigits, shortRef, STATUS_AR, useCountdown } from "@/lib/otp";

const clinicHref = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/clinic-demo`;

export function VisitVerification({ doctorId, doctorName, userPicked, onRecoverDoctor, onEligible }: {
  doctorId: string; doctorName?: string; userPicked: boolean;
  onRecoverDoctor: (id: string) => void; onEligible: (pendingId: string | null) => void;
}) {
  const qc = useQueryClient();
  const sessionM = useStartRepresentativeSession();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [sessErr, setSessErr] = useState<string | null>(null);
  const startSession = async () => {
    setSessErr(null);
    try { setSession(await sessionM.mutateAsync()); await qc.invalidateQueries({ queryKey: getListPendingVisitsQueryKey() }); }
    catch (e) { setSessErr(errMsg(e, "تعذّر بدء جلسة المندوب التجريبية.")); }
  };
  const started = useRef(false);
  useEffect(() => { if (!started.current) { started.current = true; void startSession(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingQ = useListPendingVisits({ query: { enabled: !!session, queryKey: getListPendingVisitsQueryKey(), refetchInterval: 15_000 } });
  const pv = session ? pendingQ.data?.find((visit) => visit.representativeId === session.id) : undefined;
  const startM = useStartPendingVisit();
  const verifyM = useVerifyPendingVisit();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const remaining = useCountdown(pv?.expiresAt, pv?.serverTime);

  const recovered = useRef(false);
  useEffect(() => {
    if (recovered.current || !pv) return;
    recovered.current = true;
    if (!userPicked && !doctorId && (pv.status === "pending" || pv.status === "confirmed")) onRecoverDoctor(String(pv.doctorId));
  }, [pv, userPicked, doctorId, onRecoverDoctor]);

  const matches = !!pv && !!doctorId && String(pv.doctorId) === doctorId;
  const eligible = !pendingQ.isError && matches && pv!.status === "confirmed" ? pv!.id : null;
  const cbRef = useRef(onEligible); cbRef.current = onEligible;
  useEffect(() => { cbRef.current(eligible); }, [eligible]);

  const refresh = () => qc.invalidateQueries({ queryKey: getListPendingVisitsQueryKey() });
  const isAuthErr = (e: unknown) => [401, 403].includes((e as { status?: number })?.status ?? 0);

  const start = async () => {
    if (!doctorId) return;
    if (pv && (pv.status === "pending" || pv.status === "confirmed") && !window.confirm("بدء زيارة جديدة سيستبدل الزيارة المعلّقة الحالية غير المُبلَّغ عنها، ولن يمكن استخدامها بعد ذلك. متابعة؟")) return;
    setErr(null); setCode("");
    try { await startM.mutateAsync({ data: { doctorId: Number(doctorId) } }); }
    catch (e) { setErr(errMsg(e, "تعذّر بدء الزيارة المعلّقة.")); if (isAuthErr(e)) setSession(null); }
    await refresh();
  };
  const verify = async () => {
    if (verifyM.isPending) return;
    if (!pv || code.length !== 6) { setErr("أدخل رمزاً من 6 أرقام."); return; }
    setErr(null);
    try { await verifyM.mutateAsync({ id: pv.id, data: { code } }); }
    catch (e) { setErr(errMsg(e, "تعذّر التحقق من الرمز.")); if (isAuthErr(e)) setSession(null); }
    setCode("");
    await refresh();
  };

  return (
    <section className="rise rounded-2xl border border-accent/30 bg-secondary/40 p-4 sm:p-5" data-testid="section-verification">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-primary"><KeyRound className="h-4 w-4 text-accent" />تأكيد الزيارة برمز العيادة (تجريبي)</h2>
        {session && <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border" data-testid="text-session-label"><UserRound className="h-3.5 w-3.5" />جلسة مندوب تجريبية: {session.label}</span>}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">لا تُرسل أي رسائل نصية أو غيرها. الرمز يظهر فقط في{" "}
        <a href={clinicHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent underline" data-testid="link-clinic-demo">صفحة محاكاة السكرتير<ExternalLink className="h-3 w-3" /></a>
        {" "}(تفتح في تبويب جديد). هذا التأكيد لا يثبت الحضور الفعلي.</p>

      {!session ? (
        sessErr ? <div className="space-y-2"><Banner kind="error">{sessErr}</Banner><Btn type="button" variant="ghost" onClick={startSession} data-testid="button-start-session"><RotateCw className="h-4 w-4" />إعادة بدء الجلسة التجريبية</Btn></div>
          : <Btn type="button" variant="ghost" onClick={startSession} disabled={sessionM.isPending} data-testid="button-start-session">{sessionM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}{sessionM.isPending ? "جارٍ تجهيز الجلسة..." : "بدء جلسة مندوب تجريبية"}</Btn>
      ) : pendingQ.isLoading ? <Skel className="h-24" /> : pendingQ.isError ? <ErrorState message={errMsg(pendingQ.error, "تعذّر تحميل الزيارة المعلّقة.")} onRetry={startSession} testId="error-pending" /> : (
        <div className="space-y-3">
          {err && <Banner kind="error">{err}</Banner>}
          {pv && (
            <div className={`rounded-xl border bg-card p-3 text-sm ${matches ? "border-accent/40" : "border-border opacity-80"}`} data-testid="card-pending-visit">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-primary">مرجع <span className="num font-mono" data-testid="text-pending-ref">{shortRef(pv.id)}</span> · {pv.doctorName}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${pv.status === "confirmed" ? "bg-teal-50 text-teal-800 ring-teal-600/25" : pv.status === "pending" ? "bg-amber-50 text-amber-800 ring-amber-600/25" : "bg-slate-100 text-slate-700 ring-slate-500/20"}`} data-testid="status-pending">{STATUS_AR[pv.status]}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>المندوب: {pv.representativeLabel}</span>
                {pv.status === "pending" && <><span data-testid="text-attempts">المحاولات المتبقية: <span className="num">{new Intl.NumberFormat("ar-EG").format(pv.attemptsRemaining)}</span></span><span data-testid="text-countdown">تنتهي خلال <span className="num">{fmtClock(remaining)}</span> تقريباً (صلاحية 5 دقائق)</span></>}
              </div>
              {!matches && doctorId && <p className="mt-2 text-xs font-medium text-destructive">هذه الزيارة لطبيب آخر؛ لا يمكن استخدامها مع الطبيب المختار. ابدأ زيارة جديدة.</p>}
            </div>
          )}
          {matches && pv!.status === "pending" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="otp" className="block text-sm font-semibold text-primary">رمز العيادة (6 أرقام)</label>
                <input id="otp" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={12} value={code} onChange={(e) => setCode(normalizeDigits(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void verify(); } }} className="field-input num text-center font-mono tracking-[0.5em]" placeholder="------" data-testid="input-otp" />
              </div>
              <Btn type="button" variant="teal" onClick={verify} disabled={verifyM.isPending || code.length !== 6} data-testid="button-verify">{verifyM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}تحقق</Btn>
            </div>
          ) : eligible ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-teal-800" data-testid="text-verified"><BadgeCheck className="h-4 w-4" />تم التأكيد. يمكنك الآن حفظ التقرير.</p>
          ) : (
            <Btn type="button" variant="primary" onClick={start} disabled={!doctorId || startM.isPending} data-testid="button-start-pending">
              {startM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}{doctorId ? `بدء زيارة معلّقة${doctorName ? ` مع ${doctorName}` : ""}` : "اختر الطبيب أولاً"}
            </Btn>
          )}
          {matches && (pv!.status === "pending" || pv!.status === "confirmed") && <button type="button" onClick={start} className="text-xs text-muted-foreground underline hover:text-primary" data-testid="button-restart-pending"><ShieldAlert className="me-1 inline h-3 w-3" />إعادة البدء (يستبدل الزيارة الحالية)</button>}
        </div>
      )}
    </section>
  );
}
