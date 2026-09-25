import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { getNotificationDestination } from "../utils/notificationNavigation";

const typeIcons = {
  sale_created: "🛒",
  low_stock: "⚠️",
  critical_stock: "🚨",
  edit_request: "📋",
  info: "🔔"
};

const typeColors = {
  sale_created: "#2563eb",
  low_stock: "#f59e0b",
  critical_stock: "#ef4444",
  edit_request: "#8b5cf6",
  info: "#10b981"
};

function timeAgo(dateStr) {
  if (!dateStr) return "Just now";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const InAppToasts = () => {
  const { toasts, removeToast } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  const handleToastClick = (toast) => {
    removeToast(toast.id);
    const destination = getNotificationDestination(toast, user?.role);
    navigate(destination.path + (destination.search || ""), { state: destination.state });
  };

  return (
    <div className="notification-toast-container" aria-live="polite">
      {toasts.map((toast) => {
        const icon = typeIcons[toast.type] || typeIcons.info;
        const accentColor = typeColors[toast.type] || typeColors.info;
        return (
          <div
            key={toast.id}
            className="notification-toast"
            style={{ borderLeftColor: accentColor, cursor: "pointer" }}
            onClick={() => handleToastClick(toast)}
            role="alert"
          >
            <div className="notification-toast-icon">{icon}</div>
            <div className="notification-toast-body">
              <div className="notification-toast-title">{toast.title}</div>
              <div className="notification-toast-message">{toast.message}</div>
              <div className="notification-toast-time">{timeAgo(toast.createdAt)}</div>
            </div>
            <button
              className="notification-toast-close"
              onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const NotificationPanel = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNotificationClick = (n) => {
    if (!n.isRead) {
      markAsRead(n._id);
    }
    onClose();
    const destination = getNotificationDestination(n, user?.role);
    navigate(destination.path + (destination.search || ""), { state: destination.state });
  };

  return (
    <>
      <div className="notification-panel-backdrop" onClick={onClose} />
      <div className="notification-panel">
        <div className="notification-panel-header">
          <h3>
            <span>🔔</span> Notifications
            {unreadCount > 0 && (
              <span className="notification-panel-badge">{unreadCount}</span>
            )}
          </h3>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {unreadCount > 0 && (
              <button
                className="notification-mark-all-btn"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
            <button className="notification-panel-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="notification-panel-list">
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <span style={{ fontSize: "2rem" }}>🔕</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => {
              const icon = typeIcons[n.type] || typeIcons.info;
              const accentColor = typeColors[n.type] || typeColors.info;
              return (
                <div
                  key={n._id}
                  className={`notification-item ${n.isRead ? "" : "notification-item--unread"}`}
                  onClick={() => handleNotificationClick(n)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="notification-item-icon" style={{ color: accentColor }}>
                    {icon}
                  </div>
                  <div className="notification-item-body">
                    <div className="notification-item-title">{n.title}</div>
                    <div className="notification-item-message">{n.message}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.3rem" }}>
                      <span className="notification-item-time">{timeAgo(n.createdAt)}</span>
                      <span style={{ fontSize: "0.74rem", color: "var(--primary, #10b981)", fontWeight: 600 }}>View Details →</span>
                    </div>
                  </div>
                  {!n.isRead && <div className="notification-item-dot" style={{ background: accentColor }} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};


