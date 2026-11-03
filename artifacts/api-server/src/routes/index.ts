import { Router, type IRouter } from "express";
import healthRouter from "./health";
import doctorsRouter from "./doctors";
import productsRouter from "./products";
import visitsRouter from "./visits";
import dashboardRouter from "./dashboard";
import visitVerificationRouter from "./visit-verification";

const router: IRouter = Router();

router.use(healthRouter);
router.use(doctorsRouter);
router.use(productsRouter);
router.use(visitsRouter);
router.use(dashboardRouter);
router.use(visitVerificationRouter);

export default router;
