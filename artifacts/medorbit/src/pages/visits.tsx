import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useListVisits } from "@workspace/api-client-react";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader, Skel, ErrorState, EmptyState, LinkBtn, Banner } from "@/components/ui-kit";
import { VisitCard } from "@/components/visit-row";
import { fmtNum, OUTCOMES } from "@/lib/format";

export default function Visits() {
  const saved = new URLSearchParams(useSearch()).get("saved");
  const [show, setShow] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const q = useListVisits();
  const list = useMemo(() => (q.data ?? []).filter((v) => !filter || v.outcome === filter), [q.data, filter]);
  return (
    <>
      {saved && show && <Banner kind="success" onClose={() => setShow(false)}>تم حفظ تقرير الزيارة بنجاح.</Banner>}
      <PageHeader eyebrow="التقارير" title="تقارير الزيارات" subtitle="كل الزيارات المحفوظة، الأحدث أولاً." action={<LinkBtn href="/visits/new" variant="teal" testId="link-new-visit"><Plus className="h-4 w-4" />تقرير جديد</LinkBtn>} />
      {q.data && q.data.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="تصفية حسب النتيجة">
          {["", ...OUTCOMES].map((o) => {
            const c = o ? q.data!.filter((v) => v.outcome === o).length : q.data!.length;
            return (
              <button key={o || "all"} onClick={() => setFilter(o)} aria-pressed={filter === o} data-testid={`button-filter-${o || "all"}`}
                className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${filter === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-accent/50"}`}>
                {o || "الكل"} <span className="num opacity-70">{fmtNum(c)}</span>
              </button>
            );
          })}
        </div>
      )}
      {q.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-28" />)}</div>
        : q.isError ? <ErrorState message="تعذّر تحميل تقارير الزيارات." onRetry={() => q.refetch()} />
        : !q.data?.length ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="لم تُسجَّل أي زيارة بعد" body="عند حفظ تقرير زيارة سيظهر هنا مع الطبيب والمنتج والنتيجة." action={<LinkBtn href="/visits/new" variant="teal" testId="link-empty-new-visit"><Plus className="h-4 w-4" />سجّل أول زيارة</LinkBtn>} />
        : !list.length ? <p className="rounded-xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">لا توجد زيارات بهذه النتيجة.</p>
        : <div className="space-y-3">{list.map((v) => <VisitCard key={v.id} v={v} />)}</div>}
    </>
  );
}
