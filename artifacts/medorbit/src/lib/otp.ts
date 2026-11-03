import { useEffect, useState } from "react";

export function normalizeDigits(s: string) {
  return s.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/\D/g, "").slice(0, 6);
}

/** Informative countdown only: aligns to server clock offset. Backend enforces expiry. */
export function useCountdown(expiresAt?: string, serverTime?: string) {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => { if (serverTime) setOffset(new Date(serverTime).getTime() - Date.now()); }, [serverTime]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - (now + offset)) / 1000));
}

export const fmtClock = (s: number) => new Intl.NumberFormat("ar-EG", { minimumIntegerDigits: 2 }).format(Math.floor(s / 60)) + ":" + new Intl.NumberFormat("ar-EG", { minimumIntegerDigits: 2 }).format(s % 60);
export const shortRef = (id: string) => id.slice(0, 8).toUpperCase();

export const STATUS_AR: Record<string, string> = {
  pending: "بانتظار رمز العيادة",
  confirmed: "مؤكَّدة برمز العيادة التجريبي",
  expired: "انتهت صلاحية الرمز",
  locked: "مقفلة بعد استنفاد المحاولات",
  reported: "تم حفظ تقرير لهذه الزيارة",
  superseded: "استُبدلت بزيارة أحدث",
};
