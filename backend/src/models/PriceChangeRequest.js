import mongoose from "mongoose";

const priceChangeRequestSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    oldPrice: { type: Number, required: true },
    requestedPrice: { type: Number, required: true },
    reason: { type: String, required: true },
    salesmanId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminResponse: { type: String, default: "" }
  },
  { timestamps: true, collection: "price_change_requests" }
);

export const PriceChangeRequest = mongoose.model("PriceChangeRequest", priceChangeRequestSchema);
