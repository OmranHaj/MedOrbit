import type { DoctorRecord } from "@workspace/db";
import { GetSmartRouteOptionsResponse, PlanSmartRouteBody, PlanSmartRouteResponse } from "@workspace/api-zod";
import { TOUR_DEMO_REGION } from "./tour-demo-doctors";

export const MAX_ROUTE_DOCTORS = 100;
export const DEMO_START_POINTS = [
  { id: "demo-south", name: "نقطة الانطلاق الجنوبية — تجريبية", latitude: 33.500, longitude: 36.280 },
  { id: "demo-center", name: "نقطة الانطلاق الوسطى — تجريبية", latitude: 33.510, longitude: 36.295 },
  { id: "demo-north", name: "نقطة الانطلاق الشمالية — تجريبية", latitude: 33.530, longitude: 36.320 },
];
export const ROUTE_ASSUMPTIONS = [
  "تقدير جغرافي بمعادلة هافرسين على الكرة الأرضية، وليس مسافة شبكة الطرق أو الملاحة الفعلية.",
  "سرعة ثابتة يحددها المستخدم؛ زمن الانتقال = المسافة ÷ السرعة، مقربًا إلى أعلى دقيقة كاملة.",
  "ننتظر حتى بداية استقبال المندوبين، ويجب أن تنتهي الزيارة كاملة قبل نهاية النافذة أو عندها.",
  "جولة افتراضية ليوم واحد بالتوقيت المحلي، دون استراحة أو عودة إلى نقطة البداية؛ لا ندعم نوافذ تعبر منتصف الليل.",
  "لا حركة مرور حية أو GPS أو معلومات طرق أو مواقف؛ الوضع التلقائي جشع واليدوي يتبع اختيارك، ولا يضمن أي منهما الحل الأمثل عالميًا.",
  "التخطيط للقراءة فقط: لا يحجز موعدًا ولا يبدأ زيارة أو يتحقق من رمز ولا يحفظ تقريرًا.",
  "النتيجة لقطة للسجلات وقت الحساب؛ أعد الحساب بعد تعديل إحداثيات طبيب أو نافذة استقباله.",
];
export const ROUTE_METHOD = "اختيار جشع: نقارن عدد الأطباء الذين يمكن إدراج كل منهم منفردًا بعد كل مرشح، ثم نفضل أقل زمن انتقال وانتظار، ثم أقل مسافة. هذه نظرة قصيرة للأمام ولا تضمن أكبر عدد زيارات أو المسار الأمثل.";

type Options = ReturnType<typeof GetSmartRouteOptionsResponse.parse>;
type TourInput = ReturnType<typeof PlanSmartRouteBody.parse>;
type TourPlan = ReturnType<typeof PlanSmartRouteResponse.parse>;
type StartPoint = Options["startPoints"][number];
type Position = Pick<StartPoint, "latitude" | "longitude">;
export type TourDoctor = Pick<DoctorRecord, "id" | "name" | "region" | "latitude" | "longitude" | "visitingStart" | "visitingEnd">;
type WindowDoctor = { doctor: TourDoctor; opens: number; closes: number };
const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const roundKm = (km: number) => Math.round(km * 1000) / 1000;

export function routeOptions(regions: string[]): Options {
  return {
    regions, startPoints: DEMO_START_POINTS, demoRegion: TOUR_DEMO_REGION,
    defaultVisitDurationMinutes: 15, defaultTravelSpeedKmh: 25,
    maxDoctorsPerRegion: MAX_ROUTE_DOCTORS, assumptions: ROUTE_ASSUMPTIONS,
  };
}

/** Great-circle km, no road/traffic service. Clamp for floating-point antipodes. */
export function haversineKm(from: Position, to: Position) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude), dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) *
    Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function clockLabel(minute: number) {
  const day = Math.floor(minute / 1440), local = minute % 1440;
  const clock = `${String(Math.floor(local / 60)).padStart(2, "0")}:${String(local % 60).padStart(2, "0")}`;
  return day ? `${clock} (+${day} يوم)` : clock;
}
function validDoctor(doctor: TourDoctor) {
  return Number.isFinite(doctor.latitude) && Math.abs(doctor.latitude) <= 90 &&
    Number.isFinite(doctor.longitude) && Math.abs(doctor.longitude) <= 180 &&
    timePattern.test(doctor.visitingStart) && timePattern.test(doctor.visitingEnd) &&
    doctor.visitingStart < doctor.visitingEnd;
}
function legTo(candidate: WindowDoctor, from: Position, clock: number, duration: number, speed: number) {
  const distanceKm = haversineKm(from, candidate.doctor);
  const travelMinutes = Math.ceil(distanceKm / speed * 60);
  const arrival = clock + travelMinutes, visitStart = Math.max(arrival, candidate.opens);
  const departure = visitStart + duration;
  return { distanceKm, travelMinutes, arrival, visitStart, departure, waitingMinutes: visitStart - arrival };
}

/** Pure calculation. Never changes doctors, visits, sessions, or OTP records. */
export function calculateSmartRoute(input: TourInput, startPoint: StartPoint, doctors: TourDoctor[]): TourPlan {
  const duration = input.visitDurationMinutes, speed = input.travelSpeedKmh, start = minutes(input.startTime);
  const stops: TourPlan["stops"] = [], omitted: TourPlan["omitted"] = [];
  let remaining: WindowDoctor[] = [];
  const requestedOrder = new Map(input.doctorIds?.map((id, index) => [id, index]));
  const ordered = doctors.slice().sort((a, b) => input.preserveSelectionOrder
    ? (requestedOrder.get(a.id) ?? 0) - (requestedOrder.get(b.id) ?? 0) : a.id - b.id);
  for (const doctor of ordered) {
    const omission = {
      doctorId: doctor.id, doctorName: doctor.name,
      visitingStart: doctor.visitingStart, visitingEnd: doctor.visitingEnd,
    };
    if (!validDoctor(doctor)) {
      omitted.push({ ...omission, reasonCode: "invalid_doctor_data",
        reason: "إحداثيات الطبيب أو أوقات الاستقبال غير صالحة؛ صحّح ملفه ثم أعد الحساب.",
        estimatedArrivalTime: null, estimatedDepartureTime: null });
      continue;
    }
    const item = { doctor, opens: minutes(doctor.visitingStart), closes: minutes(doctor.visitingEnd) };
    const leg = legTo(item, startPoint, start, duration, speed);
    const estimates = { estimatedArrivalTime: clockLabel(leg.arrival), estimatedDepartureTime: clockLabel(leg.departure) };
    if (item.closes <= start) {
      omitted.push({ ...omission, ...estimates, reasonCode: "window_closed_at_start",
        reason: `نافذة الاستقبال مغلقة عند الانطلاق ${input.startTime}؛ انتهت عند ${doctor.visitingEnd}.` });
    } else if (item.closes - item.opens < duration) {
      omitted.push({ ...omission, ...estimates, reasonCode: "insufficient_window",
        reason: `مدة الزيارة ${duration} دقيقة أطول من نافذة الاستقبال التي تتسع لـ ${item.closes - item.opens} دقيقة فقط.` });
    } else if (leg.departure > item.closes) {
      omitted.push({ ...omission, ...estimates, reasonCode: "unreachable_from_start",
        reason: `حتى بالذهاب المباشر من نقطة البداية، الوصول ${clockLabel(leg.arrival)} والمغادرة ${clockLabel(leg.departure)}؛ لا يمكن إنهاء الزيارة بحلول الإغلاق ${doctor.visitingEnd} بالسرعة والمدة المحددتين.` });
    } else remaining.push(item);
  }
  let position: Position = startPoint, clock = start;
  let totalDistanceKm = 0, totalTravelMinutes = 0, totalWaitingMinutes = 0;
  while (remaining.length) {
    // Explicit manual order still uses the same travel/wait/window calculation.
    // A missed window is omitted, never silently reordered to appear feasible.
    if (input.preserveSelectionOrder) {
      const first = remaining[0];
      if (legTo(first, position, clock, duration, speed).departure > first.closes) {
        const doctor = first.doctor, leg = legTo(first, position, clock, duration, speed);
        omitted.push({
          doctorId: doctor.id, doctorName: doctor.name, visitingStart: doctor.visitingStart, visitingEnd: doctor.visitingEnd,
          reasonCode: "cannot_fit_after_selected_visits", reason: "لا تتسع نافذة الاستقبال بعد الزيارات السابقة بالترتيب اليدوي المحدد.",
          estimatedArrivalTime: clockLabel(leg.arrival), estimatedDepartureTime: clockLabel(leg.departure),
        });
        remaining.shift();
        continue;
      }
    }
    const candidates = remaining.map((item) => {
      const leg = legTo(item, position, clock, duration, speed);
      if (leg.departure > item.closes) return null;
      // Individual one-step feasibility is a heuristic, NOT a jointly feasible
      // future itinerary or a guarantee of maximum visit count.
      const reachableCount = 1 + remaining.filter((other) => other.doctor.id !== item.doctor.id &&
        legTo(other, item.doctor, leg.departure, duration, speed).departure <= other.closes).length;
      return { item, leg, reachableCount };
    }).filter((candidate) => candidate !== null);
    if (!input.preserveSelectionOrder) candidates.sort((a, b) => b.reachableCount - a.reachableCount ||
      a.leg.departure - b.leg.departure || a.leg.distanceKm - b.leg.distanceKm ||
      a.item.closes - b.item.closes || a.item.doctor.id - b.item.doctor.id);
    const next = candidates[0];
    if (!next) break;
    const { doctor } = next.item, leg = next.leg;
    const distanceKm = roundKm(leg.distanceKm);
    stops.push({
      order: stops.length + 1, doctorId: doctor.id, doctorName: doctor.name, region: doctor.region,
      latitude: doctor.latitude, longitude: doctor.longitude,
      visitingStart: doctor.visitingStart, visitingEnd: doctor.visitingEnd,
      distanceKm, travelMinutes: leg.travelMinutes, arrivalTime: clockLabel(leg.arrival),
      visitStartTime: clockLabel(leg.visitStart), departureTime: clockLabel(leg.departure),
      waitingMinutes: leg.waitingMinutes,
    });
    totalDistanceKm += distanceKm;
    totalTravelMinutes += leg.travelMinutes;
    totalWaitingMinutes += leg.waitingMinutes;
    position = doctor; clock = leg.departure;
    remaining = remaining.filter((item) => item.doctor.id !== doctor.id);
  }
  for (const item of remaining) {
    const leg = legTo(item, position, clock, duration, speed), doctor = item.doctor;
    omitted.push({
      doctorId: doctor.id, doctorName: doctor.name, visitingStart: doctor.visitingStart, visitingEnd: doctor.visitingEnd,
      reasonCode: "cannot_fit_after_selected_visits",
      reason: `بعد الزيارات المختارة في هذا الترتيب، الوصول المقدّر ${clockLabel(leg.arrival)} والمغادرة ${clockLabel(leg.departure)}؛ لا تنتهي الزيارة بحلول الإغلاق ${doctor.visitingEnd}. قد يسمح ترتيب مختلف بإدراجه؛ الخوارزمية لا تضمن الحل الأمثل.`,
      estimatedArrivalTime: clockLabel(leg.arrival), estimatedDepartureTime: clockLabel(leg.departure),
    });
  }
  return {
    region: input.region, startPoint, startTime: input.startTime, endTime: clockLabel(clock),
    visitDurationMinutes: duration, travelSpeedKmh: speed, consideredDoctorCount: doctors.length,
    visitedDoctorCount: stops.length, totalDistanceKm: roundKm(totalDistanceKm),
    totalTravelMinutes, totalWaitingMinutes, totalVisitMinutes: stops.length * duration,
    totalDurationMinutes: clock - start, stops, omitted: omitted.sort((a, b) => a.doctorId - b.doctorId),
    assumptions: ROUTE_ASSUMPTIONS, method: input.preserveSelectionOrder
      ? "ترتيب يدوي حسب اختيار المستخدم؛ نحسب الانتقال والانتظار ونستبعد النوافذ غير الممكنة دون ادعاء أنه ترتيب أمثل." : ROUTE_METHOD,
  };
}
