import mongoose from "mongoose";

const returnRequestSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    reason: { type: String, required: true },
    salesmanId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminResponse: { type: String, default: "" }
  },
  { timestamps: true, collection: "return_requests" }
);

export const ReturnRequest = mongoose.model("ReturnRequest", returnRequestSchema);
