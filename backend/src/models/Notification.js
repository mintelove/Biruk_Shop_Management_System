import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    salesman_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["admin", "salesman"], default: "salesman" },
    title: { type: String },
    message: { type: String, required: true },
    type: { type: String, required: true },
    transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: "EditRequest" },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user_id: 1, isRead: 1 });
notificationSchema.index({ salesman_id: 1, isRead: 1 });

notificationSchema.pre("save", function (next) {
  if (this.salesman_id && !this.user_id) {
    this.user_id = this.salesman_id;
  }
  if (this.user_id && !this.salesman_id) {
    this.salesman_id = this.user_id;
  }
  next();
});

export const Notification = mongoose.model("Notification", notificationSchema);
