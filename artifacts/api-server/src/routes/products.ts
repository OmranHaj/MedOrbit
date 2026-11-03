import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { ListProductsResponse } from "@workspace/api-zod";

const router: IRouter = Router();
router.get("/products", async (_req, res): Promise<void> => {
  res.json(ListProductsResponse.parse(await db.select().from(productsTable).orderBy(asc(productsTable.id))));
});
export default router;
