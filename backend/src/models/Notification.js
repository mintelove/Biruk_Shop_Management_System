import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    salesman_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["price_change_approved", "price_change_rejected", "return_approved", "return_rejected"],
      required: true
    },
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: "EditRequest" },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ salesman_id: 1, isRead: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
