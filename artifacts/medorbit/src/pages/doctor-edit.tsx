import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetDoctor, useUpdateDoctor } from "@workspace/api-client-react";
import { DoctorForm, toVals } from "@/components/doctor-form";
import { PageHeader, Panel, LinkBtn, Skel, ErrorState } from "@/components/ui-kit";
import { errMsg, invalidateDoctors } from "@/lib/format";

export default function DoctorEdit() {
  const { id } = useParams<{ id: string }>();
  const did = Number(id);
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const q = useGetDoctor(did);
  const m = useUpdateDoctor();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="الدليل" title={q.data ? `تعديل: ${q.data.name}` : "تعديل الطبيب"} subtitle="جميع الحقول قابلة للتعديل، بما فيها الإحداثيات وأوقات الزيارة." action={<LinkBtn href={`/doctors/${did}`} variant="ghost" testId="link-cancel">إلغاء</LinkBtn>} />
      <Panel className="p-5 sm:p-7">
        {q.isLoading ? <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-14" />)}</div>
          : q.isError || !q.data ? <ErrorState message="تعذّر تحميل بيانات الطبيب، أو أن السجل غير موجود." onRetry={() => q.refetch()} />
          : <DoctorForm key={q.data.id} initial={toVals(q.data)} pending={m.isPending} submitLabel="حفظ التعديلات" serverError={err}
              onSubmit={async (data) => {
                setErr(null);
                try {
                  await m.mutateAsync({ id: did, data });
                  await invalidateDoctors(qc, did);
                  nav(`/doctors/${did}?saved=updated`);
                } catch (e) { setErr(errMsg(e, "تعذّر حفظ التعديلات. حاول مجدداً.")); }
              }} />}
      </Panel>
    </>
  );
}
