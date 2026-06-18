import mongoose from "mongoose";
import { config } from "./env.js";

let memoryServer = null;

async function startMemoryServer() {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri();
}

/**
 * מתחבר ל-MongoDB.
 * - USE_MEMORY_DB=true → DB זמני בזיכרון (בדיקות).
 * - אין connection string ולא production → DB זמני בזיכרון (נוחות פיתוח, עם אזהרה).
 * - אין connection string ו-production → שגיאה ברורה (לא עולים בלי DB אמיתי).
 * - אחרת → מתחבר ל-URI שהוגדר.
 */
export async function connectDB() {
  let uri = config.mongoUri;
  const opts = { serverSelectionTimeoutMS: 15000 };

  if (config.forceMemory) {
    uri = await startMemoryServer();
    opts.dbName = config.dbName;
  } else if (!uri) {
    if (config.isProduction) {
      throw new Error(
        "לא הוגדר חיבור ל-MongoDB. הגדירו DATABASE/DATABASE_PASSWORD או MONGODB_URI בסביבה.",
      );
    }
    uri = await startMemoryServer();
    opts.dbName = config.dbName;
    console.warn(
      "⚠  לא הוגדר חיבור ל-MongoDB - עולה DB זמני בזיכרון (הנתונים יימחקו עם כיבוי השרת).",
    );
    console.warn(
      "   להגדרת DB קבוע: ערכו את server/.env (DATABASE + DATABASE_PASSWORD).",
    );
  } else if (process.env.MONGODB_DB) {
    opts.dbName = config.dbName;
  }

  mongoose.set("strictQuery", true);
  mongoose.connection.on("error", (err) =>
    console.error("MongoDB connection error:", err.message),
  );

  await mongoose.connect(uri, opts);
  console.log(
    `✓ מחובר ל-MongoDB (${memoryServer ? "זמני בזיכרון" : "URI שהוגדר"})`,
  );
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
