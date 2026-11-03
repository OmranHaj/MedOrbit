import { Link } from "wouter";
import type { Visit } from "@workspace/api-client-react";
import { BadgeCheck, CalendarDays, UserRound, CircleDashed, Package } from "lucide-react";
import { OutcomeBadge } from "@/components/ui-kit";
import { fmtDate } from "@/lib/format";

export function VisitCard({ v, showDoctor = true }: { v: Visit; showDoctor?: boolean }) {
  return (
    <article id={`visit-${v.id}`} className="rise scroll-mt-24 rounded-xl border border-border bg-card p-4 transition hover:border-accent/40" data-testid={`card-visit-${v.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {showDoctor ? (
            <Link href={`/doctors/${v.doctorId}`} data-testid={`link-visit-doctor-${v.id}`} className="font-display font-semibold text-primary hover:text-accent">{v.doctorName}</Link>
          ) : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {showDoctor && <span>{v.doctorSpecialty} · {v.doctorRegion}</span>}
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(v.date)}</span>
            <span className="inline-flex items-center gap-1" data-testid={`text-visit-author-${v.id}`}><UserRound className="h-3.5 w-3.5" />{v.authorName ? v.authorName : v.authorRepresentativeId != null ? `مندوب #${v.authorRepresentativeId}` : "كاتب غير محدد (تقرير سابق)"}</span>
            <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{v.productName}</span>
          </div>
        </div>
        <OutcomeBadge outcome={v.outcome} />
      </div>
      {v.verificationStatus === "Confirmed by clinic demo code" ? (
        <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-teal-800" data-testid={`status-verification-${v.id}`}><BadgeCheck className="h-3.5 w-3.5" />مؤكَّدة برمز العيادة التجريبي <span dir="ltr" className="font-normal text-muted-foreground">Confirmed by clinic demo code</span></p>
      ) : (
        <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground" data-testid={`status-verification-${v.id}`}><CircleDashed className="h-3.5 w-3.5" />تقرير سابق غير مُتحقَّق منه <span dir="ltr">Unverified legacy report</span></p>
      )}
      <p className="mt-3 whitespace-pre-wrap border-r-2 border-accent/40 pr-3 text-sm leading-relaxed text-foreground/85" data-testid={`text-visit-notes-${v.id}`}>{v.notes}</p>
    </article>
  );
}
