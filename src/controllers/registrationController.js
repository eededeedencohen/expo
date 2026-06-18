import mongoose from 'mongoose';
import { Registration } from '../models/Registration.js';
import { validateRegistration } from '../utils/validateRegistration.js';
import { serializeRegistration } from '../utils/serialize.js';
import { buildRegistrationsWorkbook } from '../services/excelService.js';

// חלון ביטחון ל-cursor: רשומה עשויה להיכתב ל-DB מעט אחרי שנוצרה (createdAt).
// דוגמים עם חפיפה קצרה אחורה כדי לא לפספס רשומות שנוצרו במקביל ונכתבו באיחור.
// הלקוח מסיר כפילויות לפי id, כך שהחפיפה לא יוצרת רשומות כפולות.
const CURSOR_SKEW_MS = 5000;

/**
 * POST /api/registrations — יצירת הרשמה חדשה.
 */
export async function createRegistration(req, res, next) {
  try {
    const { valid, errors, data } = validateRegistration(req.body);
    if (!valid) {
      return res.status(400).json({ error: 'validation', message: 'יש שדות לא תקינים', fields: errors });
    }
    const doc = await Registration.create(data);
    return res.status(201).json({ registration: serializeRegistration(doc) });
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
        return res.status(400).json({ error: 'bad_cursor', message: 'cursor לא תקין' });
      }
      hasCursor = true;
      filter = { createdAt: { $gt: new Date(sinceMs - CURSOR_SKEW_MS) } };
    }

    const docs = await Registration.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
    const registrations = docs.map(serializeRegistration);
    const total = await Registration.estimatedDocumentCount();

    // ה-cursor הבא = ה-createdAt המאוחר ביותר שהוחזר; אם אין חדשים — נשמר ה-cursor הקיים.
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
 * DELETE /api/registrations/:id — מחיקת רשומה בודדת.
 */
export async function deleteRegistration(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'bad_id', message: 'מזהה לא תקין' });
    }
    const deleted = await Registration.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'not_found', message: 'הרשומה לא נמצאה' });
    }
    return res.json({ deleted: [id], count: 1 });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/registrations/bulk-delete — מחיקת כמה רשומות לפי מערך ids.
 */
export async function bulkDeleteRegistrations(req, res, next) {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = [...new Set(rawIds.filter((id) => mongoose.isValidObjectId(id)))];
    if (!ids.length) {
      return res.status(400).json({ error: 'bad_request', message: 'לא נבחרו רשומות תקינות למחיקה' });
    }
    const result = await Registration.deleteMany({ _id: { $in: ids } });
    return res.json({ deleted: ids, count: result.deletedCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/registrations/export — קובץ Excel עם כל ההרשמות להורדה.
 */
export async function exportRegistrations(req, res, next) {
  try {
    const docs = await Registration.find().sort({ createdAt: 1, _id: 1 }).lean();
    const records = docs.map(serializeRegistration);
    const buffer = await buildRegistrationsWorkbook(records);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="registrations.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}
