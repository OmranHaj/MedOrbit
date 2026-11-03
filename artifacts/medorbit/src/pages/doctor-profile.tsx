import { useState } from "react";
import { useParams, useSearch } from "wouter";
import { useGetDoctor, useListVisits } from "@workspace/api-client-react";
import { Clock, MapPin, Pencil, Plus, Navigation, BookOpen, ClipboardList, ArrowRight } from "lucide-react";
import { Panel, Skel, ErrorState, EmptyState, LinkBtn, Banner } from "@/components/ui-kit";
import { DoctorBriefing } from "@/components/doctor-briefing";
import { VisitCard } from "@/components/visit-row";
import { fmtDate, fmtNum, fmtTime } from "@/lib/format";

export default function DoctorProfile() {
  const { id } = useParams<{ id: string }>();
  const did = Number(id);
  const saved = new URLSearchParams(useSearch()).get("saved");
  const [showBanner, setShowBanner] = useState(true);
  const q = useGetDoctor(did);
  const visits = useListVisits({ doctorId: did });
  const d = q.data;

  if (q.isLoading) return <div className="space-y-4"><Skel className="h-40" /><Skel className="h-60" /></div>;
  if (q.isError || !d) return <ErrorState message="تعذّر تحميل ملف الطبيب، أو أن السجل غير موجود." onRetry={() => q.refetch()} />;

  return (
    <>
      {saved && showBanner && <Banner kind="success" onClose={() => setShowBanner(false)}>{saved === "created" ? "تم حفظ ملف الطبيب بنجاح." : saved === "visit" ? "تم حفظ تقرير الزيارة بنجاح." : "تم حفظ التعديلات بنجاح."}</Banner>}
      <LinkBtn href="/doctors" variant="ghost" testId="link-back-doctors"><ArrowRight className="h-4 w-4" />الأطباء</LinkBtn>
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8 rise">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border-[18px] border-[hsl(173_62%_43%/0.25)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(173_62%_43%)] font-display text-2xl font-bold text-primary">{d.name.replace(/^د\.\s*/, "").charAt(0)}</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold sm:text-3xl" data-testid="text-doctor-name">{d.name}</h1>
            <p className="mt-1 text-[hsl(173_62%_65%)]" data-testid="text-doctor-specialty">{d.specialty} · {d.region}</p>
          </div>
          <div className="flex gap-2">
            <LinkBtn href={`/doctors/${d.id}/edit`} variant="ghost" testId="link-edit-doctor"><Pencil className="h-4 w-4" />تعديل</LinkBtn>
            <LinkBtn href={`/visits/new?doctorId=${d.id}`} variant="teal" testId="link-doctor-new-visit"><Plus className="h-4 w-4" />زيارة</LinkBtn>
          </div>
        </div>
      </div>

      <DoctorBriefing key={d.id} doctorId={d.id} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="divide-y divide-border p-1 lg:col-span-1 self-start">
          <Info icon={<MapPin className="h-4 w-4" />} label="عنوان العيادة"><span data-testid="text-doctor-address">{d.clinicAddress}</span></Info>
          <Info icon={<Clock className="h-4 w-4" />} label="أوقات الزيارة"><span className="num" data-testid="text-doctor-hours">{fmtTime(d.visitingStart)} – {fmtTime(d.visitingEnd)}</span></Info>
          <Info icon={<Navigation className="h-4 w-4" />} label="الإحداثيات"><span dir="ltr" className="num font-mono text-sm" data-testid="text-doctor-coords">{d.latitude}, {d.longitude}</span></Info>
          <Info icon={<BookOpen className="h-4 w-4" />} label="الاهتمامات العلمية"><span className="whitespace-pre-wrap" data-testid="text-doctor-interests">{d.scientificInterests}</span></Info>
          <p className="px-4 py-3 text-xs text-muted-foreground">أضيف في {fmtDate(d.createdAt)}</p>
        </Panel>
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-display font-semibold text-primary">سجل الزيارات {visits.data && <span className="num text-muted-foreground">({fmtNum(visits.data.length)})</span>}</h2>
          {visits.isLoading ? <div className="space-y-3"><Skel className="h-28" /><Skel className="h-28" /></div>
            : visits.isError ? <ErrorState message="تعذّر تحميل زيارات هذا الطبيب." onRetry={() => visits.refetch()} />
            : !visits.data?.length ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="لا زيارات بعد" body="سجّل أول زيارة لهذا الطبيب لتظهر هنا." action={<LinkBtn href={`/visits/new?doctorId=${d.id}`} variant="teal" testId="link-empty-doctor-visit"><Plus className="h-4 w-4" />تسجيل زيارة</LinkBtn>} />
            : <div className="space-y-3">{visits.data.map((v) => <VisitCard key={v.id} v={v} showDoctor={false} />)}</div>}
        </section>
      </div>
    </>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-4">
      <span className="mt-0.5 text-accent">{icon}</span>
      <div className="min-w-0"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-0.5 text-sm text-foreground">{children}</div></div>
    </div>
  );
}
