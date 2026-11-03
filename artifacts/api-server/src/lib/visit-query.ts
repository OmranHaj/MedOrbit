import { db, doctorsTable, productsTable, visitsTable, pendingVisitsTable, demoSessionsTable, representativesTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";

export const visitFields = {
  id: visitsTable.id, doctorId: visitsTable.doctorId, productId: visitsTable.productId,
  pendingVisitId: visitsTable.pendingVisitId, verificationStatus: visitsTable.verificationStatus,
  outcome: visitsTable.outcome, notes: visitsTable.notes, date: visitsTable.date, createdAt: visitsTable.createdAt,
  doctorName: doctorsTable.name, doctorSpecialty: doctorsTable.specialty,
  doctorRegion: doctorsTable.region, productName: productsTable.name,
};

export function visitsQuery(executor: Pick<typeof db, "select"> = db) {
  return executor.select({
    ...visitFields,
    authorRepresentativeId: demoSessionsTable.representativeDirectoryId,
    authorName: sql<string>`coalesce(${representativesTable.name}, CASE WHEN ${pendingVisitsTable.representativeId} IS NOT NULL THEN 'مندوب تجريبي ' || left(${pendingVisitsTable.representativeId}::text,8) ELSE 'مؤلف تقرير قديم غير مسجّل' END)`,
  }).from(visitsTable)
    .innerJoin(doctorsTable, eq(visitsTable.doctorId, doctorsTable.id))
    .innerJoin(productsTable, eq(visitsTable.productId, productsTable.id))
    .leftJoin(pendingVisitsTable, eq(visitsTable.pendingVisitId, pendingVisitsTable.id))
    .leftJoin(demoSessionsTable, eq(pendingVisitsTable.representativeId, demoSessionsTable.id))
    .leftJoin(representativesTable, eq(demoSessionsTable.representativeDirectoryId, representativesTable.id))
    .orderBy(desc(visitsTable.date), desc(visitsTable.id)).$dynamic();
}
