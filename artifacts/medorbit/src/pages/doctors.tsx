import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useListDoctors } from "@workspace/api-client-react";
import { Clock, MapPin, Plus, Search, Stethoscope, X, ChevronLeft } from "lucide-react";
import { PageHeader, Skel, ErrorState, EmptyState, LinkBtn, Btn } from "@/components/ui-kit";
import { fmtNum, fmtTime } from "@/lib/format";

export default function Doctors() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [region, setRegion] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const all = useListDoctors();
  const params = useMemo(() => ({ ...(debounced && { search: debounced }), ...(specialty && { specialty }), ...(region && { region }) }), [debounced, specialty, region]);
  const filtered = useListDoctors(Object.keys(params).length ? params : undefined);
  const specialties = useMemo(() => [...new Set((all.data ?? []).map((d) => d.specialty))].sort(), [all.data]);
  const regions = useMemo(() => [...new Set((all.data ?? []).map((d) => d.region))].sort(), [all.data]);
  const hasFilter = !!(search || specialty || region);
  const clear = () => { setSearch(""); setDebounced(""); setSpecialty(""); setRegion(""); };

  return (
    <>
      <PageHeader eyebrow="الدليل" title="الأطباء" subtitle="ملفات مهنية خيالية: التخصص والمنطقة وأوقات الزيارة والاهتمامات العلمية." action={<LinkBtn href="/doctors/new" variant="teal" testId="link-new-doctor"><Plus className="h-4 w-4" />إضافة طبيب</LinkBtn>} />
      <div className="mb-5 grid gap-3 rounded-2xl border border-card-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" aria-label="بحث" data-testid="input-search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={150} placeholder="ابحث بالاسم أو العنوان أو الاهتمام..." className="field-input pr-9" />
        </div>
        <select aria-label="التخصص" data-testid="select-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="field-input sm:w-44" disabled={all.isLoading}>
          <option value="">كل التخصصات</option>{specialties.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="المنطقة" data-testid="select-region" value={region} onChange={(e) => setRegion(e.target.value)} className="field-input sm:w-44" disabled={all.isLoading}>
          <option value="">كل المناطق</option>{regions.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Btn variant="ghost" onClick={clear} disabled={!hasFilter} data-testid="button-clear-filters"><X className="h-4 w-4" />مسح</Btn>
      </div>
      {all.isError && <div className="mb-4"><ErrorState message="تعذّر تحميل قوائم التصفية." onRetry={() => all.refetch()} testId="error-filters" /></div>}

      {filtered.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-40" />)}</div>
      ) : filtered.isError ? (
        <ErrorState message="تعذّر تحميل قائمة الأطباء." onRetry={() => filtered.refetch()} />
      ) : !filtered.data?.length ? (
        hasFilter ? (
          <EmptyState icon={<Search className="h-5 w-5" />} title="لا نتائج مطابقة" body="جرّب كلمة بحث أخرى أو امسح عوامل التصفية." action={<Btn variant="ghost" onClick={clear} data-testid="button-empty-clear">مسح التصفية</Btn>} />
        ) : (
          <EmptyState icon={<Stethoscope className="h-5 w-5" />} title="الدليل فارغ" body="أضف أول ملف طبيب خيالي لتبدأ تسجيل الزيارات." action={<LinkBtn href="/doctors/new" variant="teal" testId="link-empty-new-doctor"><Plus className="h-4 w-4" />إضافة طبيب</LinkBtn>} />
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" data-testid="text-result-count">{fmtNum(filtered.data.length)} {filtered.data.length === 1 ? "طبيب" : "أطباء"}{filtered.isFetching && " · جارٍ التحديث..."}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.data.map((d) => (
              <Link key={d.id} href={`/doctors/${d.id}`} data-testid={`card-doctor-${d.id}`} className="rise group block rounded-2xl border border-card-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary font-display text-base font-bold text-primary-foreground">{d.name.replace(/^د\.\s*/, "").charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display font-semibold text-primary">{d.name}</h3>
                    <p className="text-sm text-accent">{d.specialty}</p>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-accent" />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{d.region}</span>
                  <span className="inline-flex items-center gap-1 num"><Clock className="h-3.5 w-3.5" />{fmtTime(d.visitingStart)} – {fmtTime(d.visitingEnd)}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-foreground/75">{d.scientificInterests}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
