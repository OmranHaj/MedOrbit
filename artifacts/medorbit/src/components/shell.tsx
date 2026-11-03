import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ClipboardList, LayoutDashboard, Package, Stethoscope, Plus } from "lucide-react";

const NAV = [
  { href: "/", label: "لوحة الشركة", icon: LayoutDashboard, id: "dashboard" },
  { href: "/doctors", label: "الأطباء", icon: Stethoscope, id: "doctors" },
  { href: "/visits", label: "تقارير الزيارات", icon: ClipboardList, id: "visits" },
  { href: "/products", label: "المنتجات", icon: Package, id: "products" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden><rect width="64" height="64" rx="16" fill={light ? "#16345c" : "#0f2747"} /><circle cx="32" cy="32" r="17" fill="none" stroke="#2bb3a3" strokeWidth="4" /><path d="M28 22h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#f4f8fb" /><circle cx="48" cy="20" r="4.5" fill="#2bb3a3" /></svg>
      <div className="leading-tight">
        <div className={`font-display text-lg font-bold ${light ? "text-white" : "text-primary"}`}>ميد أوربت</div>
        <div className={`text-[11px] ${light ? "text-sidebar-foreground/60" : "text-muted-foreground"}`}>سجل المندوب الطبي</div>
      </div>
    </div>
  );
}

function active(loc: string, href: string) {
  return href === "/" ? loc === "/" : loc.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Link href="/" data-testid="link-home-logo"><Logo light /></Link>
        <nav className="mt-10 space-y-1" aria-label="التنقل الرئيسي">
          {NAV.map((n) => {
            const a = active(loc, n.href);
            return (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.id}`} aria-current={a ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${a ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-white"}`}>
                <n.icon className={`h-4 w-4 ${a ? "text-sidebar-primary" : ""}`} />{n.label}
                {a && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
              </Link>
            );
          })}
        </nav>
        <Link href="/visits/new" data-testid="link-sidebar-new-visit" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-4 py-2.5 text-sm font-bold text-sidebar-primary-foreground transition hover:brightness-110">
          <Plus className="h-4 w-4" />تقرير زيارة جديد
        </Link>
        <div className="mt-auto rounded-xl border border-sidebar-border p-3 text-xs leading-relaxed text-sidebar-foreground/65">
          بيانات تجريبية خيالية بالكامل. ملاحظات مهنية فقط، بلا أي معلومات عن المرضى.
          <div className="mt-2 text-sidebar-foreground/45">مشروع هاكاثون جامعي</div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" data-testid="link-home-logo-mobile"><Logo /></Link>
        <Link href="/visits/new" data-testid="link-mobile-new-visit" className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"><Plus className="h-4 w-4" />زيارة</Link>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:mr-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <nav aria-label="التنقل السفلي" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const a = active(loc, n.href);
          return (
            <Link key={n.href} href={n.href} data-testid={`link-tab-${n.id}`} aria-current={a ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${a ? "text-accent" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" />{n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
