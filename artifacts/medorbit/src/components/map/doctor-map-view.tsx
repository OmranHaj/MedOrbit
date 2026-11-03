import "leaflet/dist/leaflet.css";
import "./doctor-map.css";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "wouter";
import type { MapDoctor, SmartRoutePlan } from "@workspace/api-client-react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { validMapHours } from "@/hooks/use-tour";

export type LocatedDoctor = MapDoctor & { latitude: number; longitude: number };
export type DoctorMapViewProps = {
  doctors: LocatedDoctor[];
  plan: SmartRoutePlan | null;
  showRoute: boolean;
  selectedIds: number[];
  focusId?: number | null;
  onToggle?: (id: number) => boolean;
  heightClass?: string;
  testId?: string;
};

const iconCache = new Map<string, L.DivIcon>();
function pinIcon(kind: "dot" | "stop" | "start", order: number | null, selected: boolean, focus: boolean) {
  const key = `${kind}-${order}-${selected}-${focus}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = focus ? 48 : kind === "dot" ? 30 : 36;
    const cls = ["mo-pin", selected && "is-selected", kind === "stop" && "is-stop", kind === "start" && "is-start", focus && "is-focus"].filter(Boolean).join(" ");
    // html contains only a validated integer, never user text
    const label = order !== null && Number.isSafeInteger(order) ? String(order) : "";
    icon = L.divIcon({ className: "mo-pin-wrap", html: `<span class="${cls}">${label}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
    iconCache.set(key, icon);
  }
  return icon;
}

function Resizer() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Fit({ points, skip }: { points: [number, number][]; skip: boolean }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (skip || !points.length || last.current === key) return;
    last.current = key;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }, [key, skip, map, points]);
  return null;
}

function Focus({ id, doctors, markers }: { id: number | null | undefined; doctors: LocatedDoctor[]; markers: React.MutableRefObject<Map<number, L.Marker>> }) {
  const map = useMap();
  const done = useRef<number | null>(null);
  const target = id ? doctors.find((d) => d.id === id) : undefined;
  useEffect(() => {
    if (!target || done.current === target.id) return;
    done.current = target.id;
    map.setView([target.latitude, target.longitude], 15);
    const t = window.setTimeout(() => markers.current.get(target.id)?.openPopup(), 80);
    return () => window.clearTimeout(t);
  }, [target, map, markers]);
  return null;
}

function DoctorPopup({ d, stop, selected, onToggle }: { d: LocatedDoctor; stop?: SmartRoutePlan["stops"][number]; selected: boolean; onToggle?: (id: number) => boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const hours = validMapHours(d);
  return (
    <div dir="rtl" className="space-y-1.5 text-right text-[13px] leading-relaxed text-[#102940]" data-testid={`popup-doctor-${d.id}`}>
      <p className="font-bold text-sm" data-testid={`text-popup-name-${d.id}`}>{d.name}</p>
      <p className="text-[#0D9488]">{d.specialty} · {d.region}</p>
      <p className="text-slate-600">{d.clinicAddress}</p>
      {hours ? <p className="num">الاستقبال: {d.visitingStart}–{d.visitingEnd}</p> : <p className="text-amber-800" data-testid={`text-popup-nohours-${d.id}`}>أوقات الاستقبال غير محددة أو غير صالحة في السجل.</p>}
      {stop && (
        <div className="rounded-lg bg-[#e6fbf8] p-2 text-xs" data-testid={`text-popup-stop-${d.id}`}>
          <p className="font-bold">المحطة {stop.order} في الجولة الحالية</p>
          <p className="num">وصول {stop.arrivalTime} · بدء {stop.visitStartTime} · مغادرة {stop.departureTime}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/doctors/${d.id}`} data-testid={`link-popup-profile-${d.id}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-[#102940]/20 px-3 text-xs font-semibold text-[#102940]">الملف الشخصي</Link>
        {onToggle && (
          <button type="button" disabled={!hours && !selected} data-testid={`button-popup-toggle-${d.id}`}
            onClick={() => { if (!onToggle(d.id)) setMsg("تعذّر التعديل: الحد الأقصى 100 طبيب في الجولة."); else setMsg(null); }}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-[#0D9488] px-3 text-xs font-bold text-white disabled:opacity-50">
            {selected ? "إزالة من الجولة" : "إضافة إلى الجولة"}
          </button>
        )}
      </div>
      {onToggle && !hours && !selected && <p className="text-xs text-amber-800">لا يمكن إضافته إلى الجولة قبل تحديد أوقات استقبال صالحة في ملفه.</p>}
      {msg && <p className="text-xs text-red-700" role="alert">{msg}</p>}
    </div>
  );
}

export default function DoctorMapView({ doctors, plan, showRoute, selectedIds, focusId, onToggle, heightClass = "h-[min(62dvh,620px)] min-h-[320px]", testId = "map-container" }: DoctorMapViewProps) {
  const markers = useRef(new Map<number, L.Marker>());
  const tileRef = useRef<L.TileLayer | null>(null);
  const [tileErr, setTileErr] = useState(false);
  const stops = useMemo(() => new Map((plan?.stops ?? []).map((s) => [s.doctorId, s])), [plan]);
  const sel = useMemo(() => new Set(selectedIds), [selectedIds]);
  const line = useMemo<[number, number][]>(() => !plan || !showRoute ? [] :
    [[plan.startPoint.latitude, plan.startPoint.longitude], ...plan.stops.slice().sort((a, b) => a.order - b.order).map((s) => [s.latitude, s.longitude] as [number, number])], [plan, showRoute]);
  const points = useMemo<[number, number][]>(() => [...doctors.map((d) => [d.latitude, d.longitude] as [number, number]), ...line], [doctors, line]);
  const focusValid = !!focusId && doctors.some((d) => d.id === focusId);

  return (
    <div dir="ltr" className={`mo-map overflow-hidden rounded-2xl border border-card-border ${heightClass}`} data-testid={testId}>
      <MapContainer center={[33.5, 36.28]} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer ref={tileRef} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileErr(true) }} />
        <Resizer />
        <Fit points={points} skip={focusValid} />
        {doctors.map((d) => {
          const stop = stops.get(d.id);
          const focus = d.id === focusId;
          return (
            <Marker key={d.id} position={[d.latitude, d.longitude]} zIndexOffset={focus ? 1000 : stop ? 500 : 0}
              icon={pinIcon(stop ? "stop" : "dot", stop ? stop.order : null, sel.has(d.id), focus)}
              title={d.name} alt={d.name}
              eventHandlers={{ add: (e) => (e.target as L.Marker).getElement()?.setAttribute("data-testid", stop ? `map-marker-stop-${d.id}` : `map-marker-${d.id}`) }}
              ref={(m) => { if (m) markers.current.set(d.id, m); else markers.current.delete(d.id); }}>
              <Popup><DoctorPopup d={d} stop={stop} selected={sel.has(d.id)} onToggle={onToggle} /></Popup>
            </Marker>
          );
        })}
        {plan && showRoute && (
          <>
            <Marker position={[plan.startPoint.latitude, plan.startPoint.longitude]} icon={pinIcon("start", null, false, false)} zIndexOffset={400}>
              <Popup><div dir="rtl" className="text-right text-[13px] text-[#102940]" data-testid="popup-start-point"><p className="font-bold">نقطة الانطلاق</p><p>{plan.startPoint.name}</p><p className="num">بدء {plan.startTime}</p></div></Popup>
            </Marker>
            <Polyline positions={line} pathOptions={{ color: "#0D9488", weight: 4, opacity: 0.85, dashArray: "8 8" }} eventHandlers={{ add: (e) => (e.target as L.Polyline).getElement()?.setAttribute("data-testid", "map-route-line") }} />
          </>
        )}
        <Focus id={focusId} doctors={doctors} markers={markers} />
      </MapContainer>
      {tileErr && (
        <div dir="rtl" role="alert" data-testid="error-map-tiles" className="absolute inset-x-3 top-3 z-[1000] flex flex-wrap items-center gap-2 rounded-xl border border-red-300 bg-white/95 p-3 text-sm text-red-800 shadow">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1">تعذّر تحميل بعض مربعات خريطة OpenStreetMap. تحقق من الاتصال ثم أعد المحاولة.</p>
          <button type="button" data-testid="button-retry-tiles" onClick={() => { setTileErr(false); tileRef.current?.redraw(); }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-300 px-3 font-semibold"><RotateCw className="h-4 w-4" />إعادة تحميل الخريطة</button>
        </div>
      )}
    </div>
  );
}
