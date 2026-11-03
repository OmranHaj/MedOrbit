import { useListProducts } from "@workspace/api-client-react";
import { FlaskConical, Package } from "lucide-react";
import { PageHeader, Skel, ErrorState, EmptyState } from "@/components/ui-kit";

export default function Products() {
  const q = useListProducts();
  return (
    <>
      <PageHeader eyebrow="الكتالوج" title="المنتجات" subtitle="كتالوج خيالي للعرض فقط، يُستخدم لاختيار موضوع النقاش في تقرير الزيارة." />
      {q.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-48" />)}</div>
        : q.isError ? <ErrorState message="تعذّر تحميل المنتجات." onRetry={() => q.refetch()} />
        : !q.data?.length ? <EmptyState icon={<Package className="h-5 w-5" />} title="الكتالوج فارغ" body="لا توجد منتجات في الكتالوج حالياً." />
        : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data.map((p, i) => (
              <article key={p.id} data-testid={`card-product-${p.id}`} className="rise flex flex-col rounded-2xl border border-card-border bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="self-start rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{p.category}</span>
                <h3 className="mt-3 font-display text-lg font-bold text-primary">{p.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/75">{p.description}</p>
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"><FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span><span className="font-semibold text-primary">الموضوع العلمي: </span>{p.scientificTopic}</span></div>
              </article>
            ))}
          </div>
        )}
    </>
  );
}
