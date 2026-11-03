/** Additive fixtures: stable demo keys preserve every existing or edited doctor. */
export const TOUR_DEMO_REGION = "منطقة الجولة التجريبية";
export const tourDemoDoctors = [
  {
    demoKey: "tour-demo-doctor-1", name: "د. هالة المدار — شخصية خيالية", specialty: "طب الأسرة",
    latitude: 33.501, longitude: 36.282, visitingStart: "08:45", visitingEnd: "09:35",
  },
  {
    demoKey: "tour-demo-doctor-2", name: "د. رامي المنار — شخصية خيالية", specialty: "الطب الداخلي",
    latitude: 33.506, longitude: 36.287, visitingStart: "09:15", visitingEnd: "10:10",
  },
  {
    demoKey: "tour-demo-doctor-3", name: "د. ندى المسار — شخصية خيالية", specialty: "الأمراض الجلدية",
    latitude: 33.513, longitude: 36.294, visitingStart: "10:00", visitingEnd: "11:20",
  },
  {
    demoKey: "tour-demo-doctor-4", name: "د. يامن القمر — شخصية خيالية", specialty: "أمراض القلب",
    latitude: 33.520, longitude: 36.301, visitingStart: "11:00", visitingEnd: "12:10",
  },
  {
    demoKey: "tour-demo-doctor-5", name: "د. سنا المدى — شخصية خيالية", specialty: "طب الأسرة",
    latitude: 33.516, longitude: 36.309, visitingStart: "13:00", visitingEnd: "14:00",
  },
  {
    demoKey: "tour-demo-doctor-6", name: "د. كنان الواحة — شخصية خيالية", specialty: "الطب الداخلي",
    latitude: 33.527, longitude: 36.317, visitingStart: "14:15", visitingEnd: "15:15",
  },
].map((doctor, index) => ({
  ...doctor, region: TOUR_DEMO_REGION,
  clinicAddress: `مدينة أوربت الخيالية، حي الجولة التجريبية، بناء ${index + 1}`,
  scientificInterests: "تواصل علمي مهني خيالي لعرض أثر أوقات استقبال المندوبين؛ لا يمثل طبيبًا أو عيادة حقيقية.",
}));
