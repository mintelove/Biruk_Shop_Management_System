import express from "express";
import mongoose from "mongoose";
import { body } from "express-validator";
import { protect, authorize } from "../middleware/auth.js";
import { handleValidation } from "../utils/validation.js";
import { User } from "../models/User.js";
import { ResetAudit } from "../models/ResetAudit.js";

const router = express.Router();

/* -------------------------------------------------------
   Constants
   ------------------------------------------------------- */

// Collections that must never be deleted under any circumstance
const ALWAYS_PRESERVED_COLLECTIONS = ["users", "resetaudits"];
const ALWAYS_PRESERVED = new Set(ALWAYS_PRESERVED_COLLECTIONS);

// Resettable collections in the database
const RESETTABLE_COLLECTIONS = ["categories", "products", "sales", "editrequests"];

// All system collections in the database
const ALL_COLLECTIONS = [...RESETTABLE_COLLECTIONS, ...ALWAYS_PRESERVED_COLLECTIONS];

// Valid retention option keys the client may send
const VALID_OPTIONS = new Set(["all", "categories", "products", "sales", "profits"]);

// Maps a retention option → the Mongoose collection name(s) it protects
const OPTION_TO_COLLECTIONS = {
  categories: ["categories"],
  products: ["products"],
  sales: ["sales", "editrequests"],
  profits: ["sales", "editrequests"]
};

// Human-readable labels used in API responses
const OPTION_LABELS = {
  categories: "Product Categories",
  products: "Product Items",
  sales: "Sales Transaction Data",
  profits: "Profit Transaction Data"
};

/* -------------------------------------------------------
   Lockout state  (in-memory, resets on server restart)
   ------------------------------------------------------- */

const lockoutMap = new Map(); // adminId → { failures, lockedUntil }
const LOCKOUT_MINUTES = parseInt(process.env.RESET_LOCKOUT_MINUTES, 10) || 15;
const MAX_FAILURES = 5;

function getLockoutEntry(adminId) {
  const id = adminId.toString();
  if (!lockoutMap.has(id)) {
    lockoutMap.set(id, { failures: 0, lockedUntil: null });
  }
  return lockoutMap.get(id);
}

function isLockedOut(adminId) {
  const entry = getLockoutEntry(adminId);
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  // If lock period has expired, reset
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    entry.failures = 0;
    entry.lockedUntil = null;
  }
  return { locked: false, remainingMs: 0 };
}

function recordFailure(adminId) {
  const entry = getLockoutEntry(adminId);
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
  }
}

function resetFailures(adminId) {
  const id = adminId.toString();
  lockoutMap.set(id, { failures: 0, lockedUntil: null });
}

/* -------------------------------------------------------
   Helpers
   ------------------------------------------------------- */

/**
 * Given the client's retention options, compute which collections
 * will be retained and which will be deleted.
 */
function computeCollectionLists(retentionOptions) {
  // If "all" is selected, we delete all resettable collections
  if (retentionOptions.includes("all") || retentionOptions.length === 0) {
    return {
      collectionsRetained: [...ALWAYS_PRESERVED_COLLECTIONS],
      collectionsDeleted: [...RESETTABLE_COLLECTIONS]
    };
  }

  // Build the set of collections that should be kept
  const retainSet = new Set();
  for (const opt of retentionOptions) {
    const cols = OPTION_TO_COLLECTIONS[opt];
    if (cols) cols.forEach((c) => retainSet.add(c));
  }

  // Always preserve system collections
  ALWAYS_PRESERVED_COLLECTIONS.forEach((c) => retainSet.add(c));

  const collectionsRetained = ALL_COLLECTIONS.filter((n) => retainSet.has(n));
  const collectionsDeleted = ALL_COLLECTIONS.filter((n) => !retainSet.has(n));

  return { collectionsRetained, collectionsDeleted };
}

/* -------------------------------------------------------
   POST /reset-database/verify-password
   ------------------------------------------------------- */

router.post(
  "/reset-database/verify-password",
  protect,
  authorize("admin"),
  [
    body("password").isString().notEmpty(),
    body("retentionOptions")
      .isArray({ min: 1 })
      .withMessage("At least one retention option is required.")
      .custom((arr) => arr.every((v) => VALID_OPTIONS.has(v)))
      .withMessage("Invalid retention option.")
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { password, retentionOptions } = req.body;

      // --- Lockout check ---
      const lockout = isLockedOut(req.user._id);
      if (lockout.locked) {
        const remainingMinutes = Math.ceil(lockout.remainingMs / 60000);
        return res.status(423).json({
          message: `Reset feature is temporarily locked due to too many failed password attempts. Try again in ${remainingMinutes} minute(s).`,
          lockedUntil: new Date(Date.now() + lockout.remainingMs).toISOString(),
          remainingMinutes
        });
      }

      // --- Fetch admin and verify password ---
      const admin = await User.findById(req.user._id);
      if (!admin) {
        return res.status(401).json({ message: "Unauthorized. User not found." });
      }

      const isPasswordValid = await admin.comparePassword(password);

      if (!isPasswordValid) {
        recordFailure(admin._id);

        // Log failed attempt
        await ResetAudit.create({
          adminId: admin._id,
          adminEmail: admin.email,
          retentionOptions,
          collectionsRetained: [],
          collectionsDeleted: [],
          status: "failed",
          failureReason: "Invalid administrator password.",
          passwordAttemptFailed: true
        });

        const entry = getLockoutEntry(admin._id);
        const attemptsRemaining = Math.max(0, MAX_FAILURES - entry.failures);

        // Check if now locked
        const newLockout = isLockedOut(admin._id);
        if (newLockout.locked) {
          return res.status(423).json({
            message: `Reset feature is temporarily locked after ${MAX_FAILURES} consecutive failed password attempts. Try again in ${LOCKOUT_MINUTES} minute(s).`,
            lockedUntil: new Date(Date.now() + newLockout.remainingMs).toISOString(),
            remainingMinutes: LOCKOUT_MINUTES
          });
        }

        return res.status(401).json({
          message: "Invalid administrator password. Reset operation cancelled.",
          attemptsRemaining
        });
      }

      // --- Password valid ---
      resetFailures(admin._id);

      // Compute retain/delete preview
      const { collectionsRetained, collectionsDeleted } = computeCollectionLists(retentionOptions);

      return res.json({
        message: "Password verified successfully.",
        verified: true,
        preview: {
          retentionOptions,
          collectionsRetained,
          collectionsDeleted,
          retentionLabels: retentionOptions
            .filter((o) => o !== "all")
            .map((o) => OPTION_LABELS[o] || o),
          deleteAll: retentionOptions.includes("all")
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* -------------------------------------------------------
   POST /reset-database/execute
   ------------------------------------------------------- */

router.post(
  "/reset-database/execute",
  protect,
  authorize("admin"),
  [
    body("password").isString().notEmpty(),
    body("retentionOptions")
      .isArray({ min: 1 })
      .custom((arr) => arr.every((v) => VALID_OPTIONS.has(v))),
    body("confirmation").equals("RESET")
  ],
  handleValidation,
  async (req, res, next) => {
    try {
      const { password, retentionOptions } = req.body;

      // --- Lockout check ---
      const lockout = isLockedOut(req.user._id);
      if (lockout.locked) {
        const remainingMinutes = Math.ceil(lockout.remainingMs / 60000);
        return res.status(423).json({
          message: `Reset feature is temporarily locked. Try again in ${remainingMinutes} minute(s).`,
          lockedUntil: new Date(Date.now() + lockout.remainingMs).toISOString(),
          remainingMinutes
        });
      }

      // --- Re-verify password (stateless — no cached tokens) ---
      const admin = await User.findById(req.user._id);
      if (!admin) {
        return res.status(401).json({ message: "Unauthorized. User not found." });
      }

      const isPasswordValid = await admin.comparePassword(password);
      if (!isPasswordValid) {
        recordFailure(admin._id);

        await ResetAudit.create({
          adminId: admin._id,
          adminEmail: admin.email,
          retentionOptions,
          collectionsRetained: [],
          collectionsDeleted: [],
          status: "failed",
          failureReason: "Invalid administrator password on execute.",
          passwordAttemptFailed: true
        });

        return res.status(401).json({
          message: "Invalid administrator password. Reset operation cancelled."
        });
      }

      resetFailures(admin._id);

      // --- Compute collections ---
      const { collectionsRetained, collectionsDeleted } = computeCollectionLists(retentionOptions);

      if (collectionsDeleted.length === 0) {
        return res.json({
          message: "No collections to delete. All data is being retained.",
          collectionsRetained,
          collectionsDeleted: []
        });
      }

      // --- Execute deletion with transaction ---
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        for (const name of collectionsDeleted) {
          const collection = mongoose.connection.collections[name] || 
                             (mongoose.connection.db ? mongoose.connection.db.collection(name) : null);
          if (collection) {
            await collection.deleteMany({}, { session });
          }
        }

        // Create success audit log inside the transaction
        await ResetAudit.create(
          [
            {
              adminId: admin._id,
              adminEmail: admin.email,
              retentionOptions,
              collectionsRetained,
              collectionsDeleted,
              status: "success",
              failureReason: "",
              passwordAttemptFailed: false
            }
          ],
          { session }
        );

        await session.commitTransaction();
      } catch (txError) {
        await session.abortTransaction();

        // Log the failure outside the aborted transaction
        await ResetAudit.create({
          adminId: admin._id,
          adminEmail: admin.email,
          retentionOptions,
          collectionsRetained: [],
          collectionsDeleted: [],
          status: "failed",
          failureReason: txError.message || "Transaction failed during deletion.",
          passwordAttemptFailed: false
        });

        return res.status(500).json({
          message: "Database reset failed. The operation was rolled back and no data was modified.",
          reason: txError.message || "Transaction failed during deletion.",
          recommendation: "Please try the operation again. If the issue persists, contact the system administrator."
        });
      } finally {
        session.endSession();
      }

      return res.json({
        message: "Database reset completed successfully.",
        collectionsRetained,
        collectionsDeleted
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
