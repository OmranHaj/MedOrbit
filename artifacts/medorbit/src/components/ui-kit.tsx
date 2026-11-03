import type { ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, RotateCw, ShieldCheck, X } from "lucide-react";
import { outcomeStyle } from "@/lib/format";

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between rise">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wide text-accent">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl" data-testid="text-page-title">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Btn({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "teal" | "ghost" }) {
  const v = { primary: "bg-primary text-primary-foreground hover:bg-primary/90", teal: "bg-accent text-accent-foreground hover:bg-accent/90", ghost: "border border-border bg-card text-primary hover:bg-muted" }[variant];
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function LinkBtn({ href, children, variant = "primary", testId }: { href: string; children: ReactNode; variant?: "primary" | "teal" | "ghost"; testId?: string }) {
  const v = { primary: "bg-primary text-primary-foreground hover:bg-primary/90", teal: "bg-accent text-accent-foreground hover:bg-accent/90", ghost: "border border-border bg-card text-primary hover:bg-muted" }[variant];
  return (
    <Link href={href} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${v}`}>
      {children}
    </Link>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-card-border bg-card shadow-[0_1px_2px_hsl(215_60%_14%/0.04),0_8px_24px_-12px_hsl(215_60%_14%/0.12)] ${className}`}>{children}</div>;
}

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export function ErrorState({ message = "تعذّر تحميل البيانات.", onRetry, testId = "error-state" }: { message?: string; onRetry: () => void; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-destructive">{message} تحقق من الاتصال ثم أعد المحاولة.</p>
      <Btn variant="ghost" onClick={onRetry} data-testid="button-retry"><RotateCw className="h-4 w-4" />إعادة المحاولة</Btn>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grid-bg flex flex-col items-center rounded-2xl border border-dashed border-input px-6 py-12 text-center" data-testid="empty-state">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-accent">{icon}</div>
      <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Banner({ kind, children, onClose }: { kind: "success" | "error"; children: ReactNode; onClose?: () => void }) {
  const ok = kind === "success";
  return (
    <div role={ok ? "status" : "alert"} aria-live="polite" data-testid={`banner-${kind}`} className={`rise mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${ok ? "border-accent/30 bg-secondary text-secondary-foreground" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="flex-1">{children}</div>
      {onClose && <button onClick={onClose} aria-label="إغلاق الرسالة" data-testid="button-close-banner" className="rounded p-0.5 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}
    </div>
  );
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return <span data-testid="status-outcome" className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${outcomeStyle[outcome] ?? outcomeStyle["لم تتم الزيارة"]}`}>{outcome}</span>;
}

export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-accent/25 bg-secondary/70 text-secondary-foreground ${compact ? "p-3 text-xs" : "p-4 text-sm"}`} data-testid="text-privacy-note">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <p><strong className="font-semibold">نسخة تجريبية:</strong> جميع الأطباء والمنتجات والعناوين خيالية. سجّل ملاحظات مهنية فقط، ولا تُدخل أي معلومات عن المرضى أو بيانات شخصية حساسة.</p>
    </div>
  );
}

export function Field({ label, error, hint, htmlFor, children }: { label: string; error?: string; hint?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-primary">{label}</label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive" id={`${htmlFor}-err`} data-testid={`error-${htmlFor}`}>{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
