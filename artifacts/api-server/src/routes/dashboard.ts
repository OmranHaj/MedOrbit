import { Router, type IRouter } from "express";
import { db, doctorsTable, productsTable, visitsTable } from "@workspace/db";
import { count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import { visitFields } from "../lib/visit-query";

const router: IRouter = Router();
router.get("/dashboard", async (_req, res): Promise<void> => {
  const dashboard = await db.transaction(async (tx) => {
    const [doctors] = await tx.select({ value: count() }).from(doctorsTable);
    const [products] = await tx.select({ value: count() }).from(productsTable);
    const [totals] = await tx.select({
      visitCount: count(),
      visitedDoctorCount: countDistinct(sql`CASE WHEN ${visitsTable.outcome} <> 'لم تتم الزيارة' THEN ${visitsTable.doctorId} END`),
      monthVisitCount: sql<number>`count(*) FILTER (WHERE date_trunc('month', ${visitsTable.date}::timestamp) = date_trunc('month', now() AT TIME ZONE 'Asia/Damascus'))::integer`,
      interestedCount: sql<number>`count(*) FILTER (WHERE ${visitsTable.outcome} = 'مهتم')::integer`,
    }).from(visitsTable);
    const outcomes = await tx.select({ label: visitsTable.outcome, count: count() })
      .from(visitsTable).groupBy(visitsTable.outcome).orderBy(visitsTable.outcome);
    const regions = await tx.select({ label: doctorsTable.region, count: count() })
      .from(doctorsTable).groupBy(doctorsTable.region).orderBy(doctorsTable.region);
    const recentVisits = await tx.select(visitFields).from(visitsTable)
      .innerJoin(doctorsTable, eq(visitsTable.doctorId, doctorsTable.id))
      .innerJoin(productsTable, eq(visitsTable.productId, productsTable.id))
      .orderBy(desc(visitsTable.date), desc(visitsTable.id)).limit(5);
    return {
      doctorCount: doctors.value, productCount: products.value, ...totals,
      outcomes, regions, recentVisits,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  res.json(GetDashboardResponse.parse(dashboard));
});
export default router;
