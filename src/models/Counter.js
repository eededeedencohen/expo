import mongoose from 'mongoose';

// מונה רציף לשמות שונים (כאן: 'registration'). $inc אטומי => מספרים ייחודיים גם תחת מקביליות.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

/**
 * מחזיר את המספר הרץ הבא עבור שם נתון (אטומי). הראשון יהיה 1.
 */
export async function nextSequence(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}
