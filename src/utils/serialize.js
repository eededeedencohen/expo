/**
 * ממיר מסמך Mongoose / אובייקט lean לפורמט אחיד שנשלח ללקוח.
 * שדה ה-id הוא מחרוזת (ObjectId) ומשמש גם כ-cursor ל-polling.
 */
export function serializeRegistration(doc) {
  return {
    id: doc._id.toString(),
    serial: doc.serial ?? null,
    firstName: doc.firstName,
    lastName: doc.lastName,
    company: doc.company,
    role: doc.role,
    phone: doc.phone,
    email: doc.email,
    product: doc.product || '',
    note: doc.note || '',
    noteColor: doc.noteColor || '',
    inRaffle: Boolean(doc.inRaffle),
    favorite: Boolean(doc.favorite),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}
