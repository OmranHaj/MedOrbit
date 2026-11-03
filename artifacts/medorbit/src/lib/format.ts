import type { QueryClient } from "@tanstack/react-query";
import {
  getListDoctorsQueryKey,
  getGetDoctorQueryKey,
  getListVisitsQueryKey,
  getGetDashboardQueryKey,
  VisitOutcome,
} from "@workspace/api-client-react";

export const nf = new Intl.NumberFormat("ar-EG");
export const fmtNum = (n: number) => nf.format(n);

export function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y) return iso;
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d));
}

export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
}

export function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const OUTCOMES = [
  VisitOutcome.مهتم,
  VisitOutcome.متابعة_لاحقة,
  VisitOutcome.غير_مهتم,
  VisitOutcome.لم_تتم_الزيارة,
] as const;

export const outcomeStyle: Record<string, string> = {
  "مهتم": "bg-teal-50 text-teal-800 ring-teal-600/25",
  "متابعة لاحقة": "bg-amber-50 text-amber-800 ring-amber-600/25",
  "غير مهتم": "bg-rose-50 text-rose-800 ring-rose-600/20",
  "لم تتم الزيارة": "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function errMsg(e: unknown, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.") {
  const anyE = e as { data?: { error?: string }; message?: string } | null;
  return anyE?.data?.error || fallback;
}

export async function invalidateDoctors(qc: QueryClient, id?: number) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: getListDoctorsQueryKey() }),
    id ? qc.invalidateQueries({ queryKey: getGetDoctorQueryKey(id) }) : Promise.resolve(),
    qc.invalidateQueries({ queryKey: getListVisitsQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
  ]);
}

export async function invalidateVisits(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: getListVisitsQueryKey() }),
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
  ]);
}
