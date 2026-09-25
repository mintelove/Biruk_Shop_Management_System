import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { emitNotification } from "../utils/socket.js";

/**
 * Notification Service – creates DB notification records and emits real-time events.
 * Integrated ON TOP of existing transaction logic; never blocks or modifies transactions.
 */

/**
 * Create sale notifications for authorized users.
 * Admin receives all sale notifications.
 * The salesman who made the sale receives their own sale notification.
 */
export async function notifySaleCreated(sale, salesmanUser) {
  try {
    const salesmanName = salesmanUser?.name || "Unknown";
    const productName = sale.product_name || "Product";
    const totalPrice = Number(sale.total_price || 0).toFixed(2);
    const quantity = sale.quantity || 0;

    // Find all admin users
    const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();

    const notifications = [];

    // Notify all admins
    for (const admin of admins) {
      // Don't double-notify if admin is also the salesman
      if (String(admin._id) === String(salesmanUser?._id)) continue;

      notifications.push({
        user_id: admin._id,
        role: "admin",
        title: "🔔 New Sale Transaction",
        message: `${salesmanName} sold ${quantity}x ${productName} for ${totalPrice} ETB`,
        type: "sale_created",
        transaction_id: sale._id
      });
    }

    // Notify the salesman who made the sale
    if (salesmanUser?._id) {
      notifications.push({
        user_id: salesmanUser._id,
        role: salesmanUser.role || "salesman",
        title: "✅ Sale Completed",
        message: `You sold ${quantity}x ${productName} for ${totalPrice} ETB`,
        type: "sale_created",
        transaction_id: sale._id
      });
    }

    if (notifications.length === 0) return;

    const savedNotifications = await Notification.insertMany(notifications);

    // Emit real-time notification events
    for (const notif of savedNotifications) {
      emitNotification({
        _id: notif._id,
        user_id: notif.user_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        transaction_id: notif.transaction_id,
        createdAt: notif.createdAt,
        isRead: false
      });
    }
  } catch (err) {
    // Notification errors must NEVER break transactions
    console.error("Notification service error (sale_created):", err.message);
  }
}

/**
 * Create stock alert notifications for admins when stock is critically low.
 */
export async function notifyLowStock(product) {
  try {
    if (!product || product.quantity > 5) return;

    const isCritical = product.quantity <= 1;
    const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();

    const title = isCritical
      ? "🚨 Critical Stock Alert"
      : "⚠️ Low Stock Warning";
    const message = isCritical
      ? `${product.name} has only ${product.quantity} unit(s) remaining!`
      : `${product.name} is running low — ${product.quantity} units left.`;

    const notifications = admins.map((admin) => ({
      user_id: admin._id,
      role: "admin",
      title,
      message,
      type: isCritical ? "critical_stock" : "low_stock"
    }));

    if (notifications.length === 0) return;

    const savedNotifications = await Notification.insertMany(notifications);

    for (const notif of savedNotifications) {
      emitNotification({
        _id: notif._id,
        user_id: notif.user_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        createdAt: notif.createdAt,
        isRead: false
      });
    }
  } catch (err) {
    console.error("Notification service error (stock_alert):", err.message);
  }
}

/**
 * Create return/edit request notifications for admins/purchasers.
 */
export async function notifyEditRequest(request, salesmanUser) {
  try {
    const salesmanName = salesmanUser?.name || "Unknown";
    const requestType = request.type === "return" ? "Return" : "Price Change";

    const reviewers = await User.find({
      role: { $in: ["admin", "purchaser"] },
      isActive: true
    }).select("_id").lean();

    const notifications = reviewers.map((reviewer) => ({
      user_id: reviewer._id,
      role: "admin",
      title: `📋 New ${requestType} Request`,
      message: `${salesmanName} submitted a ${requestType.toLowerCase()} request.`,
      type: "edit_request",
      request_id: request._id
    }));

    if (notifications.length === 0) return;

    const savedNotifications = await Notification.insertMany(notifications);

    for (const notif of savedNotifications) {
      emitNotification({
        _id: notif._id,
        user_id: notif.user_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        createdAt: notif.createdAt,
        isRead: false
      });
    }
  } catch (err) {
    console.error("Notification service error (edit_request):", err.message);
  }
}
