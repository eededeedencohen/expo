import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { nextSequence, resetSequence } from "../models/Counter.js";
import { RaffleState } from "../models/RaffleState.js";
import { validateRegistration } from "../utils/validateRegistration.js";
import { serializeRegistration } from "../utils/serialize.js";
import { buildRegistrationsWorkbook } from "../services/excelService.js";

const DEMO_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "demoRegistrations.json",
);

// חלון ביטחון ל-cursor: רשומה עשויה להיכתב ל-DB מעט אחרי שנוצרה (createdAt).
// דוגמים עם חפיפה קצרה אחורה כדי לא לפספס רשומות שנוצרו במקביל ונכתבו באיחור.
// הלקוח מסיר כפילויות לפי id, כך שהחפיפה לא יוצרת רשומות כפולות.
const CURSOR_SKEW_MS = 5000;

/**
 * POST /api/registrations - יצירת הרשמה חדשה.
 */
export async function createRegistration(req, res, next) {
  try {
    const { valid, errors, data } = validateRegistration(req.body);
    if (!valid) {
      return res
        .status(400)
        .json({
          error: "validation",
          message: "יש שדות לא תקינים",
          fields: errors,
        });
    }
    // ייחודיות: אותו טלפון או אותו מייל לא יכולים להירשם פעמיים
    const emailLower = data.email.toLowerCase();
    const phoneDigits = data.phone.replace(/\D/g, "");
    const existing = await Registration.findOne({
      $or: [{ email: emailLower }, { phoneDigits }],
    }).lean();
    if (existing) {
      const emailDup = existing.email === emailLower;
      const message = emailDup ? "כתובת המייל כבר רשומה" : "מספר הטלפון כבר רשום";
      const field = emailDup ? "email" : "phoneRest";
      return res.status(409).json({ error: "duplicate", message, fields: { [field]: message } });
    }

    const serial = await nextSequence("registration");
    const doc = await Registration.create({ ...data, serial, phoneDigits });
    return res.status(201).json({ registration: serializeRegistration(doc) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/demo - הכנסת נתוני דמו (מנהל). שימושי כשאין נרשמים.
 */
export async function insertDemoData(req, res, next) {
  try {
    const demo = JSON.parse(fs.readFileSync(DEMO_PATH, "utf8"));
    const docs = [];
    for (const d of demo) {
      const { valid, data } = validateRegistration(d);
      if (!valid) continue;
      const serial = await nextSequence("registration");
      docs.push({ ...data, serial, phoneDigits: data.phone.replace(/\D/g, "") });
    }
    const inserted = await Registration.insertMany(docs);
    return res.status(201).json({ inserted: inserted.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations              -> כל ההרשמות (טעינה ראשונית)
 * GET /api/registrations?since=<ISO>  -> רק רשומות שנוספו אחרי ה-cursor (polling)
 * ה-cursor הוא חותמת זמן (createdAt) של הרשומה האחרונה שראה הלקוח.
 */
export async function getRegistrations(req, res, next) {
  try {
    const { since } = req.query;
    let filter = {};
    let hasCursor = false;

    if (since !== undefined) {
      const sinceMs = Date.parse(since);
      if (Number.isNaN(sinceMs)) {
        return res
          .status(400)
          .json({ error: "bad_cursor", message: "cursor לא תקין" });
      }
      hasCursor = true;
      filter = { createdAt: { $gt: new Date(sinceMs - CURSOR_SKEW_MS) } };
    }

    const docs = await Registration.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const registrations = docs.map(serializeRegistration);
    const total = await Registration.estimatedDocumentCount();

    // ה-cursor הבא = ה-createdAt המאוחר ביותר שהוחזר; אם אין חדשים - נשמר ה-cursor הקיים.
    const cursor = registrations.length
      ? registrations[registrations.length - 1].createdAt
      : hasCursor
        ? since
        : null;

    return res.json({
      registrations,
      count: registrations.length,
      total,
      cursor,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/raffle - קביעת משתתפי ההגרלה (מנהל). מחליף את הקבוצה הקיימת.
 */
export async function setRaffle(req, res, next) {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = [...new Set(rawIds.filter((id) => mongoose.isValidObjectId(id)))];
    await Registration.updateMany({ inRaffle: true }, { $set: { inRaffle: false } });
    if (ids.length) {
      await Registration.updateMany({ _id: { $in: ids } }, { $set: { inRaffle: true } });
    }
    return res.json({ count: ids.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/raffle - משתתפי ההגרלה הנוכחיים (ציבורי, לתצוגה חיה).
 * מחזיר מינימום: מזהה, מספר הרשמה ושם.
 */
export async function getRaffle(req, res, next) {
  try {
    const docs = await Registration.find({ inRaffle: true })
      .select("serial firstName lastName")
      .sort({ serial: 1, _id: 1 })
      .lean();
    const participants = docs.map((d) => ({
      id: d._id.toString(),
      serial: d.serial ?? null,
      name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
    }));
    return res.json({ participants, count: participants.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/raffle/state - מצב ההגרלה החי (ציבורי).
 * מחזיר: משתתפים, האם משדרים, פקודת הסיבוב הנוכחית, מזהה סיבוב וזמן שרת (לסנכרון).
 */
export async function getRaffleState(req, res, next) {
  try {
    const stateDoc = await RaffleState.findById("current").lean();
    const docs = await Registration.find({ inRaffle: true })
      .select("serial firstName lastName")
      .sort({ serial: 1, _id: 1 })
      .lean();
    const participants = docs.map((d) => ({
      id: d._id.toString(),
      serial: d.serial ?? null,
      name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
    }));
    return res.json({
      broadcasting: stateDoc?.broadcasting || false,
      spinId: stateDoc?.spinId || 0,
      spin: stateDoc?.spin || null,
      participants,
      serverTime: Date.now(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/raffle/broadcast - הפעלה/כיבוי שידור (מנהל).
 */
export async function setBroadcast(req, res, next) {
  try {
    const on = Boolean(req.body?.on);
    const update = { broadcasting: on };
    if (!on) update.spin = null; // כיבוי משדר מנקה את הסיבוב הנוכחי
    await RaffleState.findByIdAndUpdate("current", { $set: update }, { upsert: true });
    return res.json({ broadcasting: on });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/raffle/spin - שידור פקודת סיבוב (מנהל).
 * השרת חותם startTime ומגדיל spinId כדי שכל הצופים יסונכרנו לאותה תנועה ולאותו זוכה.
 */
export async function postSpin(req, res, next) {
  try {
    const b = req.body || {};
    const spin = {
      startRotation: Number(b.startRotation) || 0,
      targetRotation: Number(b.targetRotation) || 0,
      duration: Math.min(20000, Math.max(1000, Number(b.duration) || 5500)),
      startTime: Date.now(),
      winnerId: typeof b.winnerId === "string" ? b.winnerId : null,
      winnerName: typeof b.winnerName === "string" ? b.winnerName : "",
      winnerSerial: b.winnerSerial == null ? null : Number(b.winnerSerial),
      // צילום-מצב המשתתפים שעליו חושב הזוכה — כדי שכל הלקוחות יציירו גלגל זהה
      participants: Array.isArray(b.participants)
        ? b.participants.slice(0, 1000).map((p) => ({
            id: String(p?.id || ""),
            name: String(p?.name || ""),
            serial: p?.serial == null ? null : Number(p.serial),
          }))
        : [],
    };
    const updated = await RaffleState.findByIdAndUpdate(
      "current",
      { $inc: { spinId: 1 }, $set: { spin, broadcasting: true } },
      { upsert: true, new: true }
    ).lean();
    return res.json({ spin, spinId: updated.spinId, serverTime: Date.now() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/raffle/status - קביעת סטטוס "רשום להגרלה" לרשומה בודדת (מנהל).
 */
export async function setRaffleStatus(req, res, next) {
  try {
    const { id } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "bad_id", message: "מזהה לא תקין" });
    }
    const inRaffle = Boolean(req.body.inRaffle);
    const updated = await Registration.findByIdAndUpdate(
      id,
      { $set: { inRaffle } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "הרשומה לא נמצאה" });
    }
    return res.json({ ok: true, id, inRaffle });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/favorite - סימון/ביטול מועדף לרשומה בודדת (מנהל).
 */
export async function setFavorite(req, res, next) {
  try {
    const { id } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "bad_id", message: "מזהה לא תקין" });
    }
    const favorite = Boolean(req.body.favorite);
    const updated = await Registration.findByIdAndUpdate(
      id,
      { $set: { favorite } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "הרשומה לא נמצאה" });
    }
    return res.json({ ok: true, id, favorite });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/note - עדכון הערת מנהל לרשומה בודדת (מנהל).
 */
export async function setNote(req, res, next) {
  try {
    const { id } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "bad_id", message: "מזהה לא תקין" });
    }
    const note = (typeof req.body.note === "string" ? req.body.note : "")
      .trim()
      .slice(0, 2000);
    // צבע הפתק — רק ערכים מהפלטה המוכרת (ריק = ברירת המחדל)
    const allowedColors = new Set(["", "purple", "yellow", "green", "pink", "blue"]);
    const rawColor =
      typeof req.body.noteColor === "string" ? req.body.noteColor.trim() : "";
    const noteColor = allowedColors.has(rawColor) ? rawColor : "";
    const updated = await Registration.findByIdAndUpdate(
      id,
      { $set: { note, noteColor } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "הרשומה לא נמצאה" });
    }
    return res.json({
      ok: true,
      id,
      note: updated.note || "",
      noteColor: updated.noteColor || "",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/raffle/remove - הסרת משתתף בודד מההגרלה (מנהל).
 */
export async function removeFromRaffle(req, res, next) {
  try {
    const id = req.body?.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "bad_id", message: "מזהה לא תקין" });
    }
    await Registration.updateOne({ _id: id }, { $set: { inRaffle: false } });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/lookup - חיפוש ציבורי של נרשם קיים לפי טלפון או מייל.
 * מחזיר מינימום מידע: שם פרטי + מספר ההרשמה (מספר ההגרלה) בלבד.
 */
export async function lookupRegistration(req, res, next) {
  try {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) {
      return res.status(400).json({ error: "bad_request", message: "יש להזין טלפון או מייל" });
    }

    let doc = null;
    if (query.includes("@")) {
      doc = await Registration.findOne({ email: query.toLowerCase() })
        .select("serial firstName")
        .lean();
    } else {
      const digits = query.replace(/\D/g, "");
      if (digits.length >= 6) {
        const candidates = await Registration.find({}).select("serial firstName phone").lean();
        doc = candidates.find((r) => (r.phone || "").replace(/\D/g, "") === digits) || null;
      }
    }

    if (!doc) return res.json({ found: false });
    return res.json({ found: true, serial: doc.serial ?? null, firstName: doc.firstName || "" });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/registrations/:id - מחיקת רשומה בודדת.
 */
export async function deleteRegistration(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "bad_id", message: "מזהה לא תקין" });
    }
    const deleted = await Registration.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res
        .status(404)
        .json({ error: "not_found", message: "הרשומה לא נמצאה" });
    }
    return res.json({ deleted: [id], count: 1 });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/delete-all - מחיקת כל הרשומות ואיפוס מונה הרצף.
 */
export async function deleteAllRegistrations(req, res, next) {
  try {
    const result = await Registration.deleteMany({});
    await resetSequence("registration");
    return res.json({ deleted: result.deletedCount, reset: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/bulk-delete - מחיקת כמה רשומות לפי מערך ids.
 */
export async function bulkDeleteRegistrations(req, res, next) {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = [
      ...new Set(rawIds.filter((id) => mongoose.isValidObjectId(id))),
    ];
    if (!ids.length) {
      return res
        .status(400)
        .json({
          error: "bad_request",
          message: "לא נבחרו רשומות תקינות למחיקה",
        });
    }
    const result = await Registration.deleteMany({ _id: { $in: ids } });
    return res.json({ deleted: ids, count: result.deletedCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/export - קובץ Excel עם כל ההרשמות להורדה.
 */
export async function exportRegistrations(req, res, next) {
  try {
    const docs = await Registration.find()
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const records = docs.map(serializeRegistration);
    const buffer = await buildRegistrationsWorkbook(records);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="registrations.xlsx"',
    );
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}
