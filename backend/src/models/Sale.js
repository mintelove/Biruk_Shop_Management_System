import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    purchased_price: { type: Number, default: 0, min: 0 },
    total_price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ETB", enum: ["ETB", "USD"] },
    salesman_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    operationUsed: { type: Boolean, default: false },
    priceEditedDirectly: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "returned", "returned_by_admin", "reversed", "pending_return", "return_rejected"], default: "active" },
    adminMessage: { type: String, default: "" },
    adminUsername: { type: String, default: "" },
    adminResponseDate: { type: Date },
    returned: { type: Boolean, default: false },
    returnedByAdmin: { type: Boolean, default: false },
    returnedAt: { type: Date },
    returnedBy: { type: String, default: "" },
    vatApplied: { type: Boolean, default: false },
    vat_amount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

export const Sale = mongoose.model("Sale", saleSchema);
