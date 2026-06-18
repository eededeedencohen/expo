import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createRegistration,
  getRegistrations,
  exportRegistrations,
  deleteRegistration,
  bulkDeleteRegistrations,
} from '../controllers/registrationController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { config } from '../config/env.js';

const router = Router();

// הגבלת קצב על הטופס הציבורי בלבד — נדיב כדי לא לחסום נרשמים אמיתיים מרשת משותפת,
// אך עוצר הצפה אוטומטית. ניתן לכוונון דרך RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS.
const createLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'יותר מדי בקשות, נסו שוב בעוד מספר דקות' },
});

// נתיבים ספציפיים לפני נתיבי פרמטר
router.get('/export', requireAdmin, exportRegistrations);
router.post('/bulk-delete', requireAdmin, bulkDeleteRegistrations);

router.get('/', requireAdmin, getRegistrations);
router.post('/', createLimiter, createRegistration);
router.delete('/:id', requireAdmin, deleteRegistration);

export default router;
