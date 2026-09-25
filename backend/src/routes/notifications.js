import express from "express";
import { Notification } from "../models/Notification.js";
import { Sale } from "../models/Sale.js";
import { ReturnRequest } from "../models/ReturnRequest.js";
import { PriceChangeRequest } from "../models/PriceChangeRequest.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Helper to sanitize transaction data based on user permissions
function sanitizeTransactionPermissions(transaction, userRole) {
  if (!transaction || typeof transaction !== "object") return transaction;
  // Non-admins must never see purchased_price / cost information
  if (userRole !== "admin") {
    if ("purchased_price" in transaction) {
      delete transaction.purchased_price;
    }
  }
  return transaction;
}

// Get all notifications for the logged-in user (both salesman and admin)
router.get("/", protect, authorize("salesman", "admin", "purchaser"), async (req, res, next) => {
  try {
    const userFilter = req.user.role === "admin"
      ? {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id },
            { role: "admin" }
          ]
        }
      : {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id }
          ]
        };

    const notifications = await Notification.find(userFilter)
      .populate({
        path: "transaction_id",
        populate: [
          { path: "salesman_id", select: "name email role" },
          { path: "product_id", select: "name category sku unit" }
        ]
      })
      .populate({
        path: "request_id",
        populate: [
          { path: "salesman_id", select: "name email role" },
          { path: "product_id", select: "name category sku" }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Sanitize any restricted fields
    const sanitized = notifications.map((n) => {
      if (n.transaction_id) {
        n.transaction_id = sanitizeTransactionPermissions(n.transaction_id, req.user.role);
      }
      return n;
    });

    res.json({ success: true, notifications: sanitized });
  } catch (error) {
    next(error);
  }
});

// Get single notification by ID with deep-populated details (never returns empty)
router.get("/:id", protect, authorize("salesman", "admin", "purchaser"), async (req, res, next) => {
  try {
    const paramId = req.params.id;
    if (!paramId || !paramId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID format." });
    }

    let notification = null;

    // 1. Try finding by Notification _id
    const notifQuery = req.user.role === "admin"
      ? { _id: paramId }
      : {
          _id: paramId,
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id }
          ]
        };

    const foundDoc = await Notification.findOne(notifQuery)
      .populate({
        path: "transaction_id",
        populate: [
          { path: "salesman_id", select: "name email role" },
          { path: "product_id", select: "name category sku quantity unit price" }
        ]
      })
      .populate("user_id", "name email role");

    if (foundDoc) {
      notification = foundDoc.toObject();

      // Auto mark as read
      if (!foundDoc.isRead && (req.user.role === "admin" || String(foundDoc.user_id?._id || foundDoc.user_id || foundDoc.salesman_id) === String(req.user._id))) {
        foundDoc.isRead = true;
        await foundDoc.save().catch(() => {});
        notification.isRead = true;
      }
    }

    // 2. If not found by notification _id, check if paramId is a linked transaction_id
    if (!notification) {
      const byTransQuery = req.user.role === "admin"
        ? { transaction_id: paramId }
        : {
            transaction_id: paramId,
            $or: [
              { user_id: req.user._id },
              { salesman_id: req.user._id }
            ]
          };

      const foundByTrans = await Notification.findOne(byTransQuery)
        .populate({
          path: "transaction_id",
          populate: [
            { path: "salesman_id", select: "name email role" },
            { path: "product_id", select: "name category sku quantity unit price" }
          ]
        })
        .populate("user_id", "name email role");

      if (foundByTrans) {
        notification = foundByTrans.toObject();
      }
    }

    // 3. Fallback: If paramId is a direct Sale ID, allow viewing transaction details
    if (!notification) {
      const directSale = await Sale.findById(paramId)
        .populate("salesman_id", "name email role")
        .populate("product_id", "name category sku quantity unit price")
        .lean();

      if (directSale) {
        // Authorization check: admin or creator salesman
        const canView = req.user.role === "admin" ||
          String(directSale.salesman_id?._id || directSale.salesman_id) === String(req.user._id);

        if (canView) {
          notification = {
            _id: directSale._id,
            title: `Sale Transaction #${String(directSale._id).slice(-6).toUpperCase()}`,
            message: `Sale record for ${directSale.product_name} (${directSale.quantity} units)`,
            type: "sale_created",
            transaction_id: directSale,
            createdAt: directSale.createdAt,
            isRead: true
          };
        }
      }
    }

    // If still not found anywhere, return 404 with graceful message
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Details are no longer available or access denied."
      });
    }

    // 4. Ensure transaction_id is deep-populated if it's currently an unpopulated ID
    const rawTransId = notification.transaction_id?._id || notification.transaction_id;
    if (rawTransId && (!notification.transaction_id || typeof notification.transaction_id !== "object" || !notification.transaction_id.total_price)) {
      const populatedSale = await Sale.findById(rawTransId)
        .populate("salesman_id", "name email role")
        .populate("product_id", "name category sku quantity unit price")
        .lean();
      if (populatedSale) {
        notification.transaction_id = populatedSale;
      }
    }

    // 5. Ensure request_id is populated if it points to ReturnRequest or PriceChangeRequest
    const rawReqId = notification.request_id?._id || notification.request_id;
    if (rawReqId && (!notification.request_id || typeof notification.request_id !== "object" || !notification.request_id.status)) {
      let reqDoc = await ReturnRequest.findById(rawReqId).populate("salesmanId", "name email role").lean();
      if (reqDoc) {
        reqDoc.type = "return";
        reqDoc.salesman_id = reqDoc.salesmanId;
        notification.request_id = reqDoc;
      } else {
        reqDoc = await PriceChangeRequest.findById(rawReqId).populate("salesmanId", "name email role").lean();
        if (reqDoc) {
          reqDoc.type = "price_change";
          reqDoc.salesman_id = reqDoc.salesmanId;
          notification.request_id = reqDoc;
        }
      }
    }

    // 6. Enforce role-based permission stripping on sensitive fields
    if (notification.transaction_id) {
      notification.transaction_id = sanitizeTransactionPermissions(notification.transaction_id, req.user.role);
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get("/unread-count", protect, authorize("salesman", "admin", "purchaser"), async (req, res, next) => {
  try {
    const userFilter = req.user.role === "admin"
      ? {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id },
            { role: "admin" }
          ],
          isRead: false
        }
      : {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id }
          ],
          isRead: false
        };

    const count = await Notification.countDocuments(userFilter);
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
});

// Mark a single notification as read
router.patch("/:id/read", protect, authorize("salesman", "admin", "purchaser"), async (req, res, next) => {
  try {
    const filter = req.user.role === "admin"
      ? { _id: req.params.id }
      : {
          _id: req.params.id,
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id }
          ]
        };

    const notification = await Notification.findOneAndUpdate(
      filter,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read for the logged-in user
router.patch("/read-all", protect, authorize("salesman", "admin", "purchaser"), async (req, res, next) => {
  try {
    const userFilter = req.user.role === "admin"
      ? {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id },
            { role: "admin" }
          ],
          isRead: false
        }
      : {
          $or: [
            { user_id: req.user._id },
            { salesman_id: req.user._id }
          ],
          isRead: false
        };

    await Notification.updateMany(userFilter, { isRead: true });
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    next(error);
  }
});

export default router;
