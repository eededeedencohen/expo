import crypto from 'node:crypto';
import { config } from '../config/env.js';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // timingSafeEqual דורש אורך זהה — בודקים אורך תחילה (האורך עצמו אינו סוד)
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * מגן על נתיבי הניהול (קריאת כל הרשומות + ייצוא). הטוקן נשלח בכותרת x-admin-token.
 * אם לא הוגדר ADMIN_TOKEN — הנתיב פתוח (מצב פיתוח), עם אזהרה חד-פעמית בלוג.
 */
let warned = false;
export function requireAdmin(req, res, next) {
  if (!config.adminToken) {
    // fail-closed בפרודקשן: בלי ADMIN_TOKEN נתיבי הניהול נעולים (לא חושפים PII).
    if (config.isProduction) {
      return res.status(401).json({ error: 'unauthorized', message: 'ניהול לא זמין — לא הוגדר ADMIN_TOKEN' });
    }
    if (!warned) {
      console.warn('⚠  ADMIN_TOKEN לא הוגדר — נתיבי הניהול פתוחים ללא הזדהות (פיתוח בלבד).');
      warned = true;
    }
    return next();
  }
  const provided = req.get('x-admin-token') || '';
  if (provided && safeEqual(provided, config.adminToken)) {
    return next();
  }
  return res.status(401).json({ error: 'unauthorized', message: 'נדרשת הזדהות מנהל' });
}
