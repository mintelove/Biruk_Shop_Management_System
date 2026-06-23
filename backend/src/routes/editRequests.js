import express from "express";
import { PriceChangeRequest } from "../models/PriceChangeRequest.js";
import { ReturnRequest } from "../models/ReturnRequest.js";
import { Sale } from "../models/Sale.js";
import { Product } from "../models/Product.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { protect, authorize } from "../middleware/auth.js";
import { emitStockUpdate } from "../utils/socket.js";
import { getRecordCurrency, toAppCurrency } from "../utils/currency.js";

const router = express.Router();

// Salesman: submit an edit request (price_change or return)
router.post("/", protect, authorize("salesman", "admin"), async (req, res, next) => {
  try {
    const { transactionId, type, reason, newPrice } = req.body;

    if (!transactionId || !type || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Transaction ID, type, and reason are required." });
    }
    if (!["price_change", "return", "cashback"].includes(type)) {
      return res.status(400).json({ success: false, message: "Type must be 'price_change' or 'return'." });
    }

    const normType = type === "cashback" ? "return" : type;

    if (normType === "price_change" && (!newPrice || Number(newPrice) <= 0)) {
      return res.status(400).json({ success: false, message: "New price is required for price change requests." });
    }

    const sale = await Sale.findById(transactionId).populate("product_id", "minSellingPrice currency");
    if (!sale) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    // Only the transaction owner can request
    if (String(sale.salesman_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only request edits for your own transactions." });
    }

    if (sale.status !== "active" && sale.status !== "return_rejected") {
      return res.status(400).json({ success: false, message: "Transaction is already returned/reversed or has a pending return." });
    }

    const diffMs = Date.now() - new Date(sale.createdAt).getTime();
    const ONE_HOUR = 60 * 60 * 1000;

    // Return request logic:
    if (normType === "return") {
      // Must be within 1 hour
      if (diffMs > ONE_HOUR) {
        return res.status(403).json({ success: false, message: "Return requests can only be submitted within 1 hour of the sale." });
      }
      
      // Check for existing pending request
      const existing = await ReturnRequest.findOne({
        transactionId,
        salesmanId: req.user._id,
        status: "pending"
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "You already have a pending request for this transaction." });
      }

      // Create return request
      const retReq = await ReturnRequest.create({
        transactionId,
        reason: reason.trim(),
        salesmanId: req.user._id,
        status: "pending"
      });

      // Create Reviewer Notifications (Admin and Purchaser)
      const reviewers = await User.find({ role: { $in: ["admin", "purchaser"] } });
      for (const reviewer of reviewers) {
        await Notification.create({
          user_id: reviewer._id,
          role: reviewer.role,
          title: "Return Request Submitted",
          message: `Return request submitted by ${req.user.name || req.user.email} for product "${sale.product_name}". Transaction ID: ${sale._id}. Message: "${reason.trim()}"`,
          type: "return_submitted",
          transaction_id: sale._id,
          request_id: retReq._id
        });
      }

      emitStockUpdate({
        type: "admin-notification",
        admin_ids: reviewers.map(r => String(r._id)),
        title: "Return Request Submitted",
        message: `Return request submitted by ${req.user.name || req.user.email} for product "${sale.product_name}".`
      });

      sale.status = "pending_return";
      sale.operationUsed = true; // Mark operation used
      await sale.save();

      emitStockUpdate({ type: "request-created", saleId: sale._id });

      // Return in format frontend expects
      return res.status(201).json({
        success: true,
        editRequest: {
          _id: retReq._id,
          transaction_id: transactionId,
          salesman_id: req.user._id,
          type: "return",
          reason: retReq.reason,
          status: retReq.status,
          createdAt: retReq.createdAt
        }
      });
    }

    // Price change logic:
    if (normType === "price_change") {
      // Must be after 1 hour or after already edited
      const withinHour = diffMs <= ONE_HOUR;
      if (withinHour && !sale.edited && !sale.priceEditedDirectly) {
        return res.status(400).json({
          success: false,
          message: "You can edit the price directly within the first hour."
        });
      }

      // Validate newPrice >= minSellingPrice
      if (sale.product_id && sale.product_id.minSellingPrice) {
        const sourceCurrency = getRecordCurrency(sale.product_id.currency);
        const minPrice = toAppCurrency(sale.product_id.minSellingPrice, sourceCurrency);
        if (Number(newPrice) < minPrice) {
          return res.status(400).json({
            success: false,
            message: "Requested price is below the minimum selling price."
          });
        }
      }

      // Check for existing pending request
      const existing = await PriceChangeRequest.findOne({
        transactionId,
        salesmanId: req.user._id,
        status: "pending"
      });
      if (existing) {
        return res.status(400).json({ success: false, message: "You already have a pending request for this transaction." });
      }

      // Create price change request
      const pcReq = await PriceChangeRequest.create({
        transactionId,
        oldPrice: sale.unit_price,
        requestedPrice: Number(newPrice),
        reason: reason.trim(),
        salesmanId: req.user._id,
        status: "pending"
      });

      // Create Admin Notifications
      const admins = await User.find({ role: "admin" });
      for (const admin of admins) {
        await Notification.create({
          user_id: admin._id,
          role: "admin",
          title: "Price Change Request Submitted",
          message: `Price change request submitted by ${req.user.name || req.user.email} for product "${sale.product_name}". Requested Price: ${Number(newPrice).toFixed(2)} ETB. Transaction ID: ${sale._id}. Message: "${reason.trim()}"`,
          type: "price_change_submitted",
          transaction_id: sale._id,
          request_id: pcReq._id
        });
      }

      emitStockUpdate({
        type: "admin-notification",
        admin_ids: admins.map(a => String(a._id)),
        title: "Price Change Request Submitted",
        message: `Price change request submitted by ${req.user.name || req.user.email} for product "${sale.product_name}".`
      });

      sale.operationUsed = true;
      await sale.save();

      emitStockUpdate({ type: "request-created", saleId: sale._id });

      // Return in format frontend expects
      return res.status(201).json({
        success: true,
        editRequest: {
          _id: pcReq._id,
          transaction_id: transactionId,
          salesman_id: req.user._id,
          type: "price_change",
          reason: pcReq.reason,
          newPrice: pcReq.requestedPrice,
          oldPrice: pcReq.oldPrice,
          status: pcReq.status,
          createdAt: pcReq.createdAt
        }
      });
    }

  } catch (error) {
    return next(error);
  }
});

// Admin/Purchaser: get all requests (unified from both collections)
router.get("/", protect, authorize("admin", "purchaser"), async (req, res, next) => {
  try {
    const isPurchaser = req.user.role === "purchaser";
    const [priceReqs, returnReqs] = await Promise.all([
      isPurchaser
        ? Promise.resolve([])
        : PriceChangeRequest.find()
            .sort({ createdAt: -1 })
            .populate("salesmanId", "name email")
            .populate("transactionId", "product_name product_id quantity unit_price purchased_price total_price status createdAt"),
      ReturnRequest.find()
        .sort({ createdAt: -1 })
        .populate("salesmanId", "name email")
        .populate("transactionId", "product_name product_id quantity unit_price purchased_price total_price status createdAt")
    ]);

    // Format priceReqs to match frontend schema
    const formattedPriceReqs = priceReqs.map(r => ({
      _id: r._id,
      transaction_id: r.transactionId,
      salesman_id: r.salesmanId,
      type: "price_change",
      reason: r.reason,
      newPrice: r.newPrice || r.requestedPrice,
      oldPrice: r.oldPrice,
      status: r.status,
      admin_note: r.adminResponse,
      adminUsername: r.adminUsername,
      adminResponseDate: r.adminResponseDate,
      createdAt: r.createdAt
    }));

    // Format returnReqs to match frontend schema
    const formattedReturnReqs = returnReqs.map(r => ({
      _id: r._id,
      transaction_id: r.transactionId,
      salesman_id: r.salesmanId,
      type: "return",
      reason: r.reason,
      refundAmount: r.transactionId?.total_price || r.refundAmount || 0,
      status: r.status,
      admin_note: r.adminResponse,
      adminUsername: r.adminUsername,
      adminResponseDate: r.adminResponseDate,
      createdAt: r.createdAt
    }));

    // Merge and sort by createdAt desc
    const allReqs = [...formattedPriceReqs, ...formattedReturnReqs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json(allReqs);
  } catch (error) {
    return next(error);
  }
});

// Salesman: get own requests (unified from both collections)
router.get("/mine", protect, authorize("salesman", "admin"), async (req, res, next) => {
  try {
    const [priceReqs, returnReqs] = await Promise.all([
      PriceChangeRequest.find({ salesmanId: req.user._id })
        .sort({ createdAt: -1 })
        .populate("transactionId", "product_name quantity unit_price total_price status createdAt"),
      ReturnRequest.find({ salesmanId: req.user._id })
        .sort({ createdAt: -1 })
        .populate("transactionId", "product_name quantity unit_price total_price status createdAt")
    ]);

    const formattedPriceReqs = priceReqs.map(r => ({
      _id: r._id,
      transaction_id: r.transactionId,
      salesman_id: r.salesmanId,
      type: "price_change",
      reason: r.reason,
      newPrice: r.newPrice || r.requestedPrice,
      oldPrice: r.oldPrice,
      status: r.status,
      admin_note: r.adminResponse,
      adminUsername: r.adminUsername,
      adminResponseDate: r.adminResponseDate,
      createdAt: r.createdAt
    }));

    const formattedReturnReqs = returnReqs.map(r => ({
      _id: r._id,
      transaction_id: r.transactionId,
      salesman_id: r.salesmanId,
      type: "return",
      reason: r.reason,
      refundAmount: r.transactionId?.total_price || r.refundAmount || 0,
      status: r.status,
      admin_note: r.adminResponse,
      adminUsername: r.adminUsername,
      adminResponseDate: r.adminResponseDate,
      createdAt: r.createdAt
    }));

    const allReqs = [...formattedPriceReqs, ...formattedReturnReqs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json(allReqs);
  } catch (error) {
    return next(error);
  }
});

// Admin/Purchaser: approve or reject
router.patch("/:id", protect, authorize("admin", "purchaser"), async (req, res, next) => {
  try {
    const { status, admin_note } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'." });
    }

    // Determine request type and find document
    let reqType = "";
    let requestDoc = await PriceChangeRequest.findById(req.params.id);
    if (requestDoc) {
      reqType = "price_change";
    } else {
      requestDoc = await ReturnRequest.findById(req.params.id);
      if (requestDoc) {
        reqType = "return";
      }
    }

    if (!requestDoc) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    if (req.user.role === "purchaser" && reqType === "price_change") {
      return res.status(403).json({ success: false, message: "Only administrators can review price change requests." });
    }

    if (requestDoc.status !== "pending") {
      return res.status(400).json({ success: false, message: "This request has already been reviewed." });
    }

    const sale = await Sale.findById(requestDoc.transactionId);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    if (status === "approved") {
      if (reqType === "return") {
        // Return approved: restore stock
        if (sale.status === "active" || sale.status === "pending_return") {
          const product = await Product.findById(sale.product_id);
          if (product) {
            product.quantity += sale.quantity;
            await product.save();
          }
          sale.status = "returned_by_admin";
          sale.adminMessage = "Customer refund approved and processed.";
          sale.adminUsername = req.user.name || req.user.email || "Admin";
          sale.adminResponseDate = new Date();
          sale.returned = true;
          sale.returnedByAdmin = true;
          sale.returnedAt = new Date();
          sale.returnedBy = req.user.name || req.user.email || "Admin";
          await sale.save();

          emitStockUpdate({ type: "sale-returned", saleId: sale._id, productId: sale.product_id });
        }

        // Notification
        await Notification.create({
          salesman_id: requestDoc.salesmanId,
          message: `Return request approved for "${sale.product_name}". Customer refund approved and processed.`,
          type: "return_approved",
          transaction_id: sale._id
        });
      } else if (reqType === "price_change") {
        // Price change approved: update transaction price
        if (sale.status === "active" || sale.status === "return_rejected") {
          sale.unit_price = requestDoc.requestedPrice;
          sale.total_price = Number((sale.unit_price * sale.quantity).toFixed(2));
          sale.adminMessage = "";
          sale.edited = true;
          sale.adminUsername = req.user.name || req.user.email || "Admin";
          sale.adminResponseDate = new Date();
          await sale.save();

          emitStockUpdate({ type: "sale-edited", saleId: sale._id });
        }

        // Notification
        await Notification.create({
          salesman_id: requestDoc.salesmanId,
          message: `Price change request approved for "${sale.product_name}". New price: Br ${requestDoc.requestedPrice.toFixed(2)}.`,
          type: "price_change_approved",
          transaction_id: sale._id
        });
      }
    } else {
      // REJECTED
      const rejectionReason = admin_note || (reqType === "return" ? "Return period expired or item not eligible." : "Price adjustment not approved by administrator.");

      if (reqType === "return") {
        if (sale.status === "pending_return") {
          sale.status = "return_rejected";
        }
        sale.adminMessage = `Return Request Rejected: ${rejectionReason}`;
        await sale.save();

        // Notification
        await Notification.create({
          salesman_id: requestDoc.salesmanId,
          message: `Return request rejected for "${sale.product_name}". Reason: ${rejectionReason}`,
          type: "return_rejected",
          transaction_id: sale._id
        });

        emitStockUpdate({ type: "request-rejected", saleId: sale._id });
      } else if (reqType === "price_change") {
        sale.adminMessage = `Price change request rejected by administrator.`;
        if (admin_note && admin_note.trim()) {
          sale.adminMessage += ` Reason: ${admin_note}`;
        }
        await sale.save();

        // Notification
        await Notification.create({
          salesman_id: requestDoc.salesmanId,
          message: `Price change request rejected for "${sale.product_name}". Reason: ${rejectionReason}`,
          type: "price_change_rejected",
          transaction_id: sale._id
        });

        emitStockUpdate({ type: "request-rejected", saleId: sale._id });
      }
    }

    // Save request doc updates
    requestDoc.status = status === "approved" ? "approved" : "rejected";
    requestDoc.adminResponse = admin_note || "";
    requestDoc.adminUsername = req.user.name || req.user.email || "Admin";
    requestDoc.adminResponseDate = new Date();
    await requestDoc.save();

    emitStockUpdate({
      type: "notification",
      salesman_id: String(requestDoc.salesmanId),
      requestType: reqType,
      status,
      productName: sale.product_name
    });

    return res.json({
      success: true,
      editRequest: {
        _id: requestDoc._id,
        transaction_id: sale._id,
        salesman_id: requestDoc.salesmanId,
        type: reqType,
        status: requestDoc.status,
        admin_note: requestDoc.adminResponse,
        createdAt: requestDoc.createdAt
      }
    });

  } catch (error) {
    return next(error);
  }
});

export default router;
