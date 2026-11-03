import { useSyncExternalStore } from "react";
import type { MapDoctor, SmartRouteInput, SmartRoutePlan } from "@workspace/api-client-react";

const STORAGE = "medorbit-map-selection-v1";
type TourState = {
  selectedIds: number[];
  plan: SmartRoutePlan | null;
  planInput: SmartRouteInput | null;
  source: string | null;
  storageWarning: boolean;
};
let initialIds: number[] = [], storageWarning = false;
try {
  const raw = sessionStorage.getItem(STORAGE);
  if (raw) {
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      storageWarning = true;
    } else initialIds = ids;
  }
} catch { storageWarning = true; }
let state: TourState = { selectedIds: initialIds, plan: null, planInput: null, source: null, storageWarning };
const listeners = new Set<() => void>();
function commit(next: TourState) {
  state = next;
  try { sessionStorage.setItem(STORAGE, JSON.stringify(state.selectedIds)); }
  catch { state = { ...state, storageWarning: true }; }
  listeners.forEach(listener => listener());
}
export function useTour() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state,
  );
}
export function setTourSelection(ids: number[]) {
  if (ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) return false;
  commit({ ...state, selectedIds: [...ids], plan: null, planInput: null, source: null });
  return true;
}
export function toggleTourDoctor(id: number) {
  return setTourSelection(state.selectedIds.includes(id)
    ? state.selectedIds.filter(item => item !== id) : [...state.selectedIds, id]);
}
export function clearTourPlan() {
  if (state.plan) commit({ ...state, plan: null, planInput: null, source: null });
}
export function clearTour() { setTourSelection([]); }
export function tourSource(doctors: MapDoctor[], input: SmartRouteInput) {
  const selected = input.doctorIds ? new Set(input.doctorIds) : null;
  return JSON.stringify(doctors.filter(d => selected ? selected.has(d.id) : d.region === input.region)
    .slice().sort((a, b) => a.id - b.id).map(d => [d.id, d.name, d.region, d.latitude, d.longitude, d.visitingStart, d.visitingEnd]));
}
export function publishTour(plan: SmartRoutePlan, input: SmartRouteInput, doctors?: MapDoctor[]) {
  commit({
    ...state,
    selectedIds: input.doctorIds ? [...input.doctorIds] : plan.stops.map(stop => stop.doctorId),
    plan, planInput: { ...input, doctorIds: input.doctorIds ? [...input.doctorIds] : undefined },
    source: doctors ? tourSource(doctors, input) : null,
  });
}
export function validMapCoordinates(d: Pick<MapDoctor, "latitude" | "longitude">): d is typeof d & { latitude: number; longitude: number } {
  return typeof d.latitude === "number" && Number.isFinite(d.latitude) && Math.abs(d.latitude) <= 90 &&
    typeof d.longitude === "number" && Number.isFinite(d.longitude) && Math.abs(d.longitude) <= 180;
}
export function validMapHours(d: Pick<MapDoctor, "visitingStart" | "visitingEnd">) {
  const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return typeof d.visitingStart === "string" && typeof d.visitingEnd === "string" &&
    pattern.test(d.visitingStart) && pattern.test(d.visitingEnd) && d.visitingStart < d.visitingEnd;
}
