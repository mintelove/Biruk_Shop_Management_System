/**
 * Utility for direct notification routing based on notification type and related data.
 * Pure navigation helper — NO popup, modal, or intermediate empty window.
 */

export function getNotificationDestination(notification, currentUserRole) {
  if (!notification) {
    return { path: currentUserRole === "purchaser" ? "/products" : "/" };
  }

  const type = String(notification.type || "").toLowerCase();
  const title = String(notification.title || "").toLowerCase();
  const message = String(notification.message || "").toLowerCase();

  // Extract transaction ID if present
  let transactionId = null;
  if (notification.transaction_id) {
    transactionId = typeof notification.transaction_id === "object"
      ? notification.transaction_id._id
      : notification.transaction_id;
  }
  if (!transactionId && notification.transactionId) {
    transactionId = notification.transactionId;
  }

  // Extract product info if present
  let productId = null;
  let productName = null;

  if (typeof notification.transaction_id === "object" && notification.transaction_id) {
    if (notification.transaction_id.product_id) {
      productId = typeof notification.transaction_id.product_id === "object"
        ? notification.transaction_id.product_id._id
        : notification.transaction_id.product_id;
      productName = notification.transaction_id.product_name || notification.transaction_id.product_id?.name;
    } else if (notification.transaction_id.product_name) {
      productName = notification.transaction_id.product_name;
    }
  }

  if (!productId && notification.product_id) {
    productId = typeof notification.product_id === "object"
      ? notification.product_id._id
      : notification.product_id;
    productName = notification.product_id?.name || productName;
  }

  if (!productId && notification.productId) {
    productId = notification.productId;
  }

  // Fallback: extract product name or transaction ID from title/message if not explicitly given
  if (!transactionId) {
    const txMatch = message.match(/transaction\s*id:\s*([a-f0-9]{24})/i) ||
                    title.match(/#([A-Z0-9]{6,24})/i);
    if (txMatch) {
      transactionId = txMatch[1];
    }
  }

  // 1. Sale / Transaction notifications
  // (sale_created, return_submitted, return_approved, return_rejected, price_change_submitted, price_change_approved, price_change_rejected, or transactionId exists)
  if (
    type.includes("sale") ||
    type.includes("transaction") ||
    type.includes("return") ||
    type.includes("price_change") ||
    transactionId
  ) {
    // If user is purchaser, they don't have access to /sales, route to products
    if (currentUserRole === "purchaser") {
      const searchTarget = productName || productId || "";
      return {
        path: "/products",
        search: searchTarget ? `?search=${encodeURIComponent(searchTarget)}` : "",
        state: { productId, productName, search: searchTarget }
      };
    }

    return {
      path: "/sales",
      search: transactionId ? `?search=${encodeURIComponent(transactionId)}` : "",
      state: { transactionId, highlightId: transactionId }
    };
  }

  // 2. Stock / Low Stock / Critical Stock / Product notifications
  if (
    type.includes("stock") ||
    type.includes("product") ||
    type.includes("inventory") ||
    title.includes("stock") ||
    title.includes("product")
  ) {
    const searchTarget = productName || productId || "";
    return {
      path: "/products",
      search: searchTarget ? `?search=${encodeURIComponent(searchTarget)}` : "",
      state: { productId, search: searchTarget }
    };
  }

  // 3. Profit / Purchases notifications
  if (
    type.includes("profit") ||
    type.includes("purchase") ||
    title.includes("profit") ||
    title.includes("purchase")
  ) {
    return {
      path: "/purchases"
    };
  }

  // 4. User notifications
  if (
    type.includes("user") ||
    title.includes("user") ||
    title.includes("account")
  ) {
    return {
      path: currentUserRole === "admin" ? "/users" : "/"
    };
  }

  // Default fallback
  return {
    path: currentUserRole === "purchaser" ? "/products" : "/"
  };
}
