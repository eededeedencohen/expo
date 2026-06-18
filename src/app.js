import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import registrationRoutes from "./routes/registrationRoutes.js";
import { config } from "./config/env.js";

export function createApp() {
  const app = express();

  if (config.trustProxy !== false) {
    app.set("trust proxy", config.trustProxy);
  }

  // security headers. CSP מותאם ל-SPA המוגש מאותו origin (סקריפט/סגנון עצמיים).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  const corsOptions = config.clientOrigin
    ? { origin: config.clientOrigin.split(",").map((s) => s.trim()) }
    : {};
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/registrations", registrationRoutes);

  // 404 לכל נתיב API שלא נתפס
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "not_found", message: "נתיב לא קיים" });
  });

  // הגשת ה-client הבנוי מ-server/dist (מועתק לשם ע"י "npm run deploy").
  // נרשם תמיד ובודק קיום per-request - כך שאחרי deploy אין צורך לאתחל את השרת.
  // בפיתוח, כשאין dist, ה-static וה-fallback פשוט מדלגים הלאה.
  app.use(express.static(config.clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const indexFile = path.join(config.clientDist, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return next();
  });

  // טיפול בשגיאות מרכזי
  app.use((err, req, res, next) => {
    if (err && err.name === "ValidationError") {
      const fields = {};
      for (const key of Object.keys(err.errors || {})) {
        fields[key] = err.errors[key].message;
      }
      return res
        .status(400)
        .json({ error: "validation", message: "יש שדות לא תקינים", fields });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "server_error", message: "שגיאת שרת" });
  });

  return app;
}
