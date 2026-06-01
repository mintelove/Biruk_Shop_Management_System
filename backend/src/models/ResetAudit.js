import mongoose from "mongoose";

const resetAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminEmail: { type: String, required: true },
    retentionOptions: [{ type: String }],
    collectionsRetained: [{ type: String }],
    collectionsDeleted: [{ type: String }],
    status: { type: String, enum: ["success", "failed"], required: true },
    failureReason: { type: String, default: "" },
    passwordAttemptFailed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const ResetAudit = mongoose.model("ResetAudit", resetAuditSchema);
