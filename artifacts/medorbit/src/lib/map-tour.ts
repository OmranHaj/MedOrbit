import { useEffect } from "react";
import type { MapDoctor, SmartRouteInput, SmartRoutePlan } from "@workspace/api-client-react";
import { tourSource, validMapCoordinates } from "@/hooks/use-tour";

export const ROUTE_NOTICE = "المسار المعروض تقريبي ولا يمثل طرق القيادة الفعلية.";
export const MAP_QUERY = { refetchInterval: 30_000, staleTime: 0, refetchOnWindowFocus: true } as const;

/** Returns an Arabic reason when the stored plan no longer matches the current map data, otherwise null. */
export function planIssue(plan: SmartRoutePlan, input: SmartRouteInput | null, source: string | null, doctors: MapDoctor[]): string | null {
  if (!source) return "تعذّر التأكد من حداثة بيانات الخريطة عند الحساب. الجدول محفوظ كلقطة؛ أعد الحساب لإظهار الخط.";
  if (!input || !source || source !== tourSource(doctors, input)) return "تغيّرت بيانات الأطباء أو مدخلات الجولة بعد آخر حساب، لذلك أُخفيت الجولة. أعد الحساب من مخطّط الجولة.";
  for (const s of plan.stops) {
    const d = doctors.find((x) => x.id === s.doctorId);
    if (!d || !validMapCoordinates(d) || d.latitude !== s.latitude || d.longitude !== s.longitude || d.visitingStart !== s.visitingStart || d.visitingEnd !== s.visitingEnd)
      return "لم تعد إحداثيات أو أوقات بعض محطات الجولة مطابقة للسجلات الحالية، لذلك أُخفيت الجولة. أعد الحساب.";
  }
  return null;
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title;
    const metas = [
      ["meta[name='description']", description],
      ["meta[property='og:title']", title],
      ["meta[property='og:description']", description],
    ].map(([sel, content]) => {
      const el = document.querySelector<HTMLMetaElement>(sel);
      const previous = el?.content;
      if (el) el.content = content;
      return { el, previous };
    });
    document.title = title;
    return () => {
      document.title = prevTitle;
      for (const { el, previous } of metas) if (el && previous !== undefined) el.content = previous;
    };
  }, [title, description]);
}
