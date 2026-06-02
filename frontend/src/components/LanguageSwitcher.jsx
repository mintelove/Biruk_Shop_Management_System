import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";

export const LanguageSwitcher = () => {
  const { language, switchLanguage, t } = useI18n();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const isAdmin = user?.role === "admin";
  const isSalesman = user?.role === "salesman";
  const showNotifications = isAdmin || isSalesman;

  const fetchNotifications = async () => {
    if (!showNotifications) return;
    try {
      const res = await api.get("/notifications");
      if (res.data && res.data.success) {
        const mapped = res.data.notifications.map(n => ({
          ...n,
          read: n.isRead || n.read || false
        }));
        setNotifications(mapped);
      }
    } catch (e) {
      /* silent */
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true, isRead: true } : n));
    } catch (e) {
      /* silent */
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => api.patch(`/notifications/${n._id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
    } catch (e) {
      /* silent */
    }
  };

  // Salesman: listen for approval/rejection notifications
  useSocket("stock:update", (payload) => {
    const userId = user?.id || user?._id;

    // Salesman notification (approval / rejection)
    if (payload && payload.type === "notification" && isSalesman && String(payload.salesman_id) === String(userId)) {
      const newToast = {
        id: Date.now(),
        title: payload.status === "approved" ? "🎉 Request Approved" : "❌ Request Rejected",
        message: `Your ${payload.requestType === "price_change" ? "price change" : "return"} request for "${payload.productName}" was ${payload.status}.`,
        status: payload.status
      };
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 5000);
      fetchNotifications();
    }

    // Admin notification (new request submitted by salesman)
    if (payload && payload.type === "admin-notification" && isAdmin) {
      const adminIds = payload.admin_ids || [];
      if (adminIds.length === 0 || adminIds.includes(String(userId))) {
        const newToast = {
          id: Date.now(),
          title: `📋 ${payload.title || "New Request"}`,
          message: payload.message || "A salesman submitted a new request.",
          status: "info"
        };
        setToasts(prev => [...prev, newToast]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, 6000);
        fetchNotifications();
      }
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // Helper to derive notification type label
  const getTypeLabel = (notif) => {
    const t = notif.type || "";
    if (t.includes("price_change")) return "Price Change Request";
    if (t.includes("return")) return "Return Request";
    return "Notification";
  };

  // Helper to derive status badge for notification
  const getStatusInfo = (notif) => {
    const t = notif.type || "";
    if (t.includes("submitted")) return { label: "Pending Review", color: "#f59e0b", bg: "#f59e0b22" };
    if (t.includes("approved")) return { label: "Approved", color: "#10b981", bg: "#10b98122" };
    if (t.includes("rejected")) return { label: "Rejected", color: "#ef4444", bg: "#ef444422" };
    return { label: "Info", color: "#6366f1", bg: "#6366f122" };
  };

  // Short preview of notification message for dropdown
  const getMessagePreview = (msg) => {
    if (!msg) return "";
    return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
  };

  return (
    <div className="language-switcher">
      <span className="header-shop-name">Sunlight Electric</span>
      <span className="header-divider" />
      <label htmlFor="language-select">{t("common.language")}</label>
      <select id="language-select" value={language} onChange={(e) => switchLanguage(e.target.value)}>
        <option value="en">{t("common.english")}</option>
        <option value="am">{t("common.amharic")}</option>
      </select>

      {showNotifications && (
        <>
          <span className="header-divider" />
          <div className="notification-bell-container">
            <button className="notification-bell-btn" onClick={() => setShowDropdown(!showDropdown)} style={{ padding: 0, border: "none", background: "none", fontSize: "1.2rem", cursor: "pointer", position: "relative" }}>
              🔔
              {unreadCount > 0 && (
                <span className="notification-badge" style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: "50%", minWidth: "16px", textAlign: "center" }}>
                  {unreadCount}
                </span>
              )}
            </button>
            {showDropdown && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h4>{isAdmin ? "Admin Notifications" : "Notifications"}</h4>
                  {unreadCount > 0 && (
                    <button className="notification-clear-all" onClick={markAllAsRead}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="notification-empty">No notifications yet</div>
                  ) : (
                    notifications.map(n => {
                      const statusInfo = getStatusInfo(n);
                      return (
                        <div key={n._id} className={`notification-item ${!n.read ? "unread" : ""}`} onClick={() => { markAsRead(n._id); setSelectedNotification(n); setShowDropdown(false); }}>
                          <div className="notification-item-header">
                            <span className="notification-type-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                              {getTypeLabel(n)}
                            </span>
                            <span className="notification-time">{new Date(n.createdAt).toLocaleTimeString()}</span>
                          </div>
                          {n.title && <div className="notification-title-line">{n.title}</div>}
                          <div className="notification-message">{getMessagePreview(n.message)}</div>
                          <div className="notification-view-link">View Details →</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {user && (
        <>
          <span className="header-divider" />
          <div className="header-user-profile" style={{ fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
            👤 {user.name}
          </div>
        </>
      )}

      {/* Floating Notification Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.status}`}>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* View Full Message Modal */}
      {selectedNotification && (
        <div className="notification-detail-modal" onClick={() => setSelectedNotification(null)}>
          <div className="notification-detail-card" onClick={e => e.stopPropagation()}>
            <h3>🔔 {isAdmin ? "Admin Notification Details" : "Notification Details"}</h3>
            
            <div className="notification-detail-body">
              {selectedNotification.message}
            </div>

            <div className="notification-detail-meta">
              <div>
                <strong>Status:</strong>{" "}
                {(() => {
                  const si = getStatusInfo(selectedNotification);
                  return (
                    <span style={{
                      display: "inline-block",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: si.bg,
                      color: si.color,
                      textTransform: "uppercase"
                    }}>
                      {si.label}
                    </span>
                  );
                })()}
              </div>
              <div>
                <strong>Type:</strong>{" "}
                {getTypeLabel(selectedNotification)}
              </div>
              <div>
                <strong>Transaction ID:</strong>{" "}
                <code style={{ fontSize: "0.8rem", background: "rgba(0,0,0,0.05)", padding: "0.1rem 0.3rem", borderRadius: "4px" }}>
                  {selectedNotification.transaction_id?._id || selectedNotification.transaction_id || "N/A"}
                </code>
              </div>
              {isAdmin && (
                <div>
                  <strong>Submitted By:</strong>{" "}
                  {selectedNotification.transaction_id?.salesman_name || "Salesman"}
                </div>
              )}
              {isSalesman && (
                <div>
                  <strong>Admin Name:</strong>{" "}
                  {selectedNotification.transaction_id?.adminUsername || selectedNotification.transaction_id?.returnedBy || "Administrator"}
                </div>
              )}
              <div>
                <strong>Date:</strong>{" "}
                {new Date(selectedNotification.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.2rem", gap: "0.5rem" }}>
              <button className="btn primary" onClick={() => setSelectedNotification(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
