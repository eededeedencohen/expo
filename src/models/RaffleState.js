import mongoose from "mongoose";

// מצב ההגרלה החי — מסמך יחיד (_id: 'current').
// broadcasting: האם המנהל משדר; spin: פקודת הסיבוב הנוכחית; spinId: עולה בכל סיבוב.
const raffleStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "current" },
    broadcasting: { type: Boolean, default: false },
    spinId: { type: Number, default: 0 },
    spin: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { minimize: false, timestamps: true }
);

export const RaffleState = mongoose.model("RaffleState", raffleStateSchema);
