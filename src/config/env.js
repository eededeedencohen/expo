import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env נמצא בשורש תיקיית server. נתיב מוחלט כדי שלא יהיה תלוי ב-cwd.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

/**
 * בונה את ה-connection string ל-MongoDB.
 * תומך ב-DATABASE עם placeholder של <PASSWORD> + DATABASE_PASSWORD, או ב-MONGODB_URI מלא.
 */
function buildMongoUri() {
  const database = (process.env.DATABASE || "").trim();
  if (database) {
    const password = (process.env.DATABASE_PASSWORD || "").trim();
    return database.replace("<PASSWORD>", encodeURIComponent(password));
  }
  return (process.env.MONGODB_URI || "").trim();
}

function parseTrustProxy(value) {
  if (value === undefined || value === "") return false;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  isProduction: process.env.NODE_ENV === "production",
  mongoUri: buildMongoUri(),
  dbName: (process.env.MONGODB_DB || "exspo").trim(),
  // כפיית DB זמני בזיכרון (שימושי לבדיקות מקומיות מבלי לגעת ב-DB האמיתי)
  forceMemory: process.env.USE_MEMORY_DB === "true",
  // סיסמת/טוקן מנהל. אם ריק - נתיבי הניהול פתוחים (לא מומלץ ל-production).
  adminToken: (process.env.ADMIN_TOKEN || "").trim(),
  // הגבלת CORS (רשימת origins מופרדת בפסיקים). ריק = פתוח.
  clientOrigin: (process.env.CLIENT_ORIGIN || "").trim(),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },
  // תיקיית ה-build של ה-client שמועתקת לשרת ע"י "npm run deploy" שבלקוח (server/dist)
  clientDist: path.resolve(__dirname, "..", "..", "dist"),
};
