import { db, doctorsTable, productsTable, visitsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

export const visitFields = {
  id: visitsTable.id, doctorId: visitsTable.doctorId, productId: visitsTable.productId,
  outcome: visitsTable.outcome, notes: visitsTable.notes, date: visitsTable.date, createdAt: visitsTable.createdAt,
  doctorName: doctorsTable.name, doctorSpecialty: doctorsTable.specialty,
  doctorRegion: doctorsTable.region, productName: productsTable.name,
};

export function visitsQuery() {
  return db.select(visitFields).from(visitsTable)
    .innerJoin(doctorsTable, eq(visitsTable.doctorId, doctorsTable.id))
    .innerJoin(productsTable, eq(visitsTable.productId, productsTable.id))
    .orderBy(desc(visitsTable.date), desc(visitsTable.id)).$dynamic();
}
