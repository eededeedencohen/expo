import mongoose from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d][\d\s-]{6,19}$/;

const registrationSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "יש להזין שם פרטי"],
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: [true, "יש להזין שם משפחה"],
      trim: true,
      maxlength: 60,
    },
    company: {
      type: String,
      required: [true, "יש להזין שם חברה"],
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      required: [true, "יש להזין תפקיד"],
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      required: [true, "יש להזין טלפון"],
      trim: true,
      maxlength: 25,
      match: [PHONE_RE, "מספר טלפון לא תקין"],
    },
    email: {
      type: String,
      required: [true, "יש להזין כתובת מייל"],
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: [EMAIL_RE, "כתובת מייל לא תקינה"],
    },
    // אופציונלי - מוצר/ים שנבחרו (יכול לכלול כמה, מופרדים בפסיק, + טקסט חופשי)
    product: { type: String, trim: true, default: "", maxlength: 600 },
    // מספר הרשמה רץ וייחודי (אינדקס הרשמה / מספר להגרלה)
    serial: { type: Number, index: true },
    // האם הנרשם משתתף כרגע בהגרלה (לתצוגה חיה ומשותפת בין מכשירים)
    inRaffle: { type: Boolean, default: false, index: true },
    // ספרות הטלפון בלבד — לבדיקת ייחודיות (ללא תלות בפורמט)
    phoneDigits: { type: String, index: true },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  },
);

// אינדקס מורכב - משרת את ה-cursor של ה-polling (createdAt) ואת שבירת השוויון (_id)
registrationSchema.index({ createdAt: 1, _id: 1 });

export const Registration = mongoose.model("Registration", registrationSchema);
