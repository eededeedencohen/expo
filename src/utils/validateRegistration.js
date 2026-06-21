const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d][\d\s-]{6,19}$/;

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

/**
 * ולידציה + ניקוי של גוף הבקשה ליצירת הרשמה.
 * מחזיר { valid, errors, data } כאשר data כבר מנוקה ומוכן לשמירה.
 */
export function validateRegistration(body = {}) {
  const data = {
    firstName: clean(body.firstName, 60),
    lastName: clean(body.lastName, 60),
    company: clean(body.company, 120),
    role: clean(body.role, 80),
    phone: clean(body.phone, 25),
    email: clean(body.email, 120),
    product: clean(body.product, 600),
  };

  const errors = {};
  if (!data.firstName) errors.firstName = 'יש להזין שם פרטי';
  if (!data.lastName) errors.lastName = 'יש להזין שם משפחה';
  if (!data.company) errors.company = 'יש להזין שם חברה';
  if (!data.role) errors.role = 'יש להזין תפקיד';

  if (!data.phone) errors.phone = 'יש להזין טלפון';
  else if (!PHONE_RE.test(data.phone)) errors.phone = 'מספר טלפון לא תקין';

  if (!data.email) errors.email = 'יש להזין כתובת מייל';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'כתובת מייל לא תקינה';

  return { valid: Object.keys(errors).length === 0, errors, data };
}
