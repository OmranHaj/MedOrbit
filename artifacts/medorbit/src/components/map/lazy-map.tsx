import { Component, Suspense, lazy, type ReactNode } from "react";
import type { MapDoctor, SmartRouteInput, SmartRoutePlan } from "@workspace/api-client-react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Skel } from "@/components/ui-kit";
import { validMapCoordinates } from "@/hooks/use-tour";
import { ROUTE_NOTICE, planIssue } from "@/lib/map-tour";
import type { DoctorMapViewProps, LocatedDoctor } from "./doctor-map-view";

const load = () => import("./doctor-map-view");
const View = lazy(load);

class MapBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" data-testid="error-map-load" className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive sm:flex-row sm:items-center">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p className="flex-1">تعذّر تحميل الخريطة التفاعلية. ما زالت قائمة الأطباء والفلاتر متاحة أدناه. إعادة تحميل الصفحة تبقي الاختيار، لكن تتطلب حساب الجولة مجددًا.</p>
        <button type="button" data-testid="button-retry-map" onClick={this.props.onRetry}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 font-semibold text-primary"><RotateCw className="h-4 w-4" />إعادة تحميل الصفحة</button>
      </div>
    );
  }
}

export function LazyDoctorMap(props: DoctorMapViewProps) {
  return (
    <MapBoundary onRetry={() => window.location.reload()}>
      <Suspense fallback={<Skel className={props.heightClass ?? "h-[min(62dvh,620px)] min-h-[320px]"} />}>
        <View {...props} />
      </Suspense>
    </MapBoundary>
  );
}

export function locatedOnly(doctors: MapDoctor[]): LocatedDoctor[] {
  return doctors.filter(validMapCoordinates) as LocatedDoctor[];
}

/** Map embedded in the planner: shows exactly the plan's stops, start point and line. */
export function PlannerMap({ plan, input, source, doctors }: { plan: SmartRoutePlan; input: SmartRouteInput | null; source: string | null; doctors: MapDoctor[] | undefined }) {
  if (!doctors) return <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground" data-testid="text-planner-map-unavailable">بيانات الخريطة غير متاحة حاليًا؛ الجدول أعلاه يبقى صحيحًا.</p>;
  const issue = planIssue(plan, input, source, doctors);
  if (issue) return <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900" data-testid="text-planner-map-stale">{issue}</p>;
  const ids = new Set(plan.stops.map((s) => s.doctorId));
  const docs = locatedOnly(doctors).filter((d) => ids.has(d.id));
  return (
    <section className="space-y-2" data-testid="section-planner-map">
      <h2 className="font-display text-lg font-bold text-primary">الجولة على الخريطة</h2>
      <p className="text-xs text-muted-foreground" data-testid="text-route-notice">{ROUTE_NOTICE}</p>
      <LazyDoctorMap doctors={docs} plan={plan} showRoute selectedIds={[...ids]} testId="map-container-planner" heightClass="h-[min(55dvh,520px)] min-h-[300px]" />
    </section>
  );
}
