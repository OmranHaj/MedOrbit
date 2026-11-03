import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

// This phase is an unauthenticated, fictional-only hackathon demo.
// Reject cross-origin browser writes; never use it for real company/patient data.
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.get("origin");
  const expectedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin) {
    try {
      if (new URL(origin).host !== expectedHost) {
        res.status(403).json({ error: "الطلب من مصدر غير مسموح." }); return;
      }
    } catch { res.status(403).json({ error: "مصدر الطلب غير صحيح." }); return; }
  }
  next();
});
app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "المسار المطلوب غير موجود." }); });

const handleError: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "صيغة البيانات المرسلة غير صحيحة." }); return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "حجم البيانات يتجاوز الحد المسموح." }); return;
  }
  req.log.error({ err }, "Request failed");
  res.status(500).json({ error: "تعذر إكمال العملية أو الاتصال بقاعدة البيانات. أعد المحاولة." });
};
app.use(handleError);

export default app;
