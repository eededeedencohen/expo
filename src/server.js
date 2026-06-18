import { createApp } from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { config } from "./config/env.js";

async function start() {
  await connectDB();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✓ השרת רץ על http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} התקבל - סוגר את השרת…`);

    // נפילה כפויה אם הסגירה נתקעת (חיבורי keep-alive שלא נסגרים)
    const forceExit = setTimeout(() => {
      console.error("סגירה לא הסתיימה בזמן - יציאה כפויה.");
      process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(async () => {
      try {
        await disconnectDB();
      } catch (err) {
        console.error("שגיאה בניתוק מה-DB:", err);
      } finally {
        clearTimeout(forceExit);
        process.exit(0);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("כשל בהפעלת השרת:", err);
  process.exit(1);
});
