# exspo - server

Express + Mongoose API לטופס ההרשמה ולוח הבקרה. שומר נרשמים ב-MongoDB ומייצא לאקסל.

## הרצה

```bash
npm install
cp .env.example .env   # ומלאו DATABASE / DATABASE_PASSWORD / ADMIN_TOKEN
npm run dev            # node --watch (פיתוח)
npm start              # production
```

ללא חיבור ל-MongoDB בפיתוח - השרת מעלה MongoDB זמני בזיכרון.

## משתני סביבה (`.env`)

| משתנה               | תיאור                                                   |
| ------------------- | ------------------------------------------------------- |
| `DATABASE`          | connection string ל-Atlas עם `<PASSWORD>` כ-placeholder |
| `DATABASE_PASSWORD` | הסיסמה שמוחלפת ב-`<PASSWORD>`                           |
| `MONGODB_URI`       | חלופה ל-URI מלא (במקום DATABASE/DATABASE_PASSWORD)      |
| `PORT`              | פורט השרת (ברירת מחדל 5000)                             |
| `ADMIN_TOKEN`       | סיסמת מנהל לנתיבי הקריאה/ייצוא. ריק = פתוח (לא מומלץ)   |
| `CLIENT_ORIGIN`     | הגבלת CORS ל-origins (מופרד בפסיק). ריק = פתוח          |
| `RATE_LIMIT_MAX`    | מקס' בקשות POST לחלון (ברירת מחדל 100)                  |
| `TRUST_PROXY`       | להגדיר מאחורי reverse proxy (למשל `1`)                  |

## נתיבי API

| Method | Path                             | הזדהות |
| ------ | -------------------------------- | ------ |
| POST   | `/api/registrations`             | -      |
| GET    | `/api/registrations[?since=ISO]` | מנהל   |
| GET    | `/api/registrations/export`      | מנהל   |
| GET    | `/api/health`                    | -      |

נתיבי "מנהל" דורשים כותרת `x-admin-token` התואמת ל-`ADMIN_TOKEN`.

## מבנה

```
src/
├─ config/      # env + חיבור ל-DB
├─ models/      # סכמת Mongoose
├─ controllers/ # לוגיקת הנתיבים
├─ routes/      # הגדרת ה-API
├─ services/    # בניית קובץ Excel
├─ middleware/  # הזדהות מנהל
├─ utils/       # ולידציה + סריאליזציה
├─ app.js       # הרכבת ה-Express app
└─ server.js    # נקודת כניסה
```
