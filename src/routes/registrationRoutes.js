import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createRegistration,
  getRegistrations,
  exportRegistrations,
  deleteRegistration,
  bulkDeleteRegistrations,
  deleteAllRegistrations,
  lookupRegistration,
  setRaffle,
  getRaffle,
  removeFromRaffle,
  getRaffleState,
  setBroadcast,
  postSpin,
  setRaffleStatus,
  insertDemoData,
} from "../controllers/registrationController.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { config } from "../config/env.js";

const router = Router();

// הגבלת קצב על הטופס הציבורי בלבד - נדיב כדי לא לחסום נרשמים אמיתיים מרשת משותפת,
// אך עוצר הצפה אוטומטית. ניתן לכוונון דרך RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS.
const createLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limited",
    message: "יותר מדי בקשות, נסו שוב בעוד מספר דקות",
  },
});

// חיפוש ציבורי של נרשם קיים — מוגבל בקצב נגד אנומרציה
const lookupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "יותר מדי בקשות, נסו שוב בעוד מספר דקות" },
});

// נתיבים ספציפיים לפני נתיבי פרמטר
router.post("/lookup", lookupLimiter, lookupRegistration);
router.get("/raffle/state", getRaffleState); // ציבורי — מצב חי לשידור
router.post("/raffle/broadcast", requireAdmin, setBroadcast);
router.post("/raffle/spin", requireAdmin, postSpin);
router.post("/raffle/status", requireAdmin, setRaffleStatus);
router.get("/raffle", getRaffle); // ציבורי — תצוגה חיה
router.post("/raffle", requireAdmin, setRaffle);
router.post("/raffle/remove", requireAdmin, removeFromRaffle);
router.get("/export", requireAdmin, exportRegistrations);
router.post("/delete-all", requireAdmin, deleteAllRegistrations);
router.post("/bulk-delete", requireAdmin, bulkDeleteRegistrations);
router.post("/demo", requireAdmin, insertDemoData);

router.get("/", requireAdmin, getRegistrations);
router.post("/", createLimiter, createRegistration);
router.delete("/:id", requireAdmin, deleteRegistration);

export default router;
