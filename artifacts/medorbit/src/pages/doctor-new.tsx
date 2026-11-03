import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateDoctor } from "@workspace/api-client-react";
import { DoctorForm, emptyDoctor } from "@/components/doctor-form";
import { PageHeader, Panel, LinkBtn } from "@/components/ui-kit";
import { errMsg, invalidateDoctors } from "@/lib/format";

export default function DoctorNew() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const m = useCreateDoctor();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="الدليل" title="إضافة طبيب" subtitle="استخدم بيانات خيالية فقط. لا تُدخل أرقام هواتف حقيقية أو صوراً أو بيانات شخصية." action={<LinkBtn href="/doctors" variant="ghost" testId="link-cancel">إلغاء</LinkBtn>} />
      <Panel className="p-5 sm:p-7">
        <DoctorForm initial={emptyDoctor} pending={m.isPending} submitLabel="حفظ الطبيب" serverError={err}
          onSubmit={async (data) => {
            setErr(null);
            try {
              const doc = await m.mutateAsync({ data });
              await invalidateDoctors(qc, doc.id);
              nav(`/doctors/${doc.id}?saved=created`);
            } catch (e) { setErr(errMsg(e, "تعذّر حفظ الطبيب. تحقق من البيانات وحاول مجدداً.")); }
          }} />
      </Panel>
    </>
  );
}
