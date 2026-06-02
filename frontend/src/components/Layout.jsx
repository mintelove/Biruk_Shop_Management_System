import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { api } from "../api/client";
import { useSocket } from "../hooks/useSocket";

const linkClass = (active) => (active ? "sidebar-link active" : "sidebar-link");

export const Layout = () => {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [toasts, setToasts] = useState([]);

  const fetchNotifications = async () => {
    if (user?.role !== "salesman") return;
    try {
      const res = await api.get("/notifications");
      if (res.data && res.data.success) {
        setNotifications(res.data.notifications);
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
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (e) {
      /* silent */
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => api.patch(`/notifications/${n._id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      /* silent */
    }
  };

  useSocket("stock:update", (payload) => {
    if (payload && payload.type === "notification" && String(payload.salesman_id) === String(user?._id)) {
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
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>{t("app.title")}</h2>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0.5rem 0 1.2rem", gap: "0.5rem", position: "relative" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem", fontWeight: 500 }}>
            {user?.name} ({user?.role === "admin" ? t("common.admin") : t("common.salesman")})
          </p>
          {user?.role === "salesman" && (
            <div className="notification-bell-container">
              <button className="notification-bell-btn" onClick={() => setShowDropdown(!showDropdown)} style={{ padding: 0, border: "none", background: "none", fontSize: "1.2rem", cursor: "pointer", position: "relative" }}>
                🔔
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="notification-badge" style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: "50%" }}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showDropdown && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h4>Notifications</h4>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <button className="notification-clear-all" onClick={markAllAsRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">No notifications yet</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} className={`notification-item ${!n.read ? "unread" : ""}`} onClick={() => { markAsRead(n._id); setShowDropdown(false); }}>
                          <div className="notification-message">{n.message}</div>
                          <div className="notification-time">{new Date(n.createdAt).toLocaleTimeString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <Link to="/" className={linkClass(location.pathname === "/")}>
            {t("nav.dashboard")}
          </Link>
          <Link to="/products" className={linkClass(location.pathname === "/products")}>
            {t("nav.products")}
          </Link>
          <Link to="/sales" className={linkClass(location.pathname === "/sales")}>
            {t("nav.sales")}
          </Link>
          <Link to="/purchases" className={linkClass(location.pathname === "/purchases")}>
            {t("nav.purchases") || "Profit"}
          </Link>
          {isAdmin && (
            <Link to="/users" className={linkClass(location.pathname === "/users")}>
              {t("nav.users")}
            </Link>
          )}
          {isAdmin && (
            <Link to="/settings" className={linkClass(location.pathname === "/settings")}>
              {t("nav.settings")}
            </Link>
          )}
          <Link to="/about" className={linkClass(location.pathname === "/about")}>
            {t("nav.about")}
          </Link>
        </nav>
        <button className="btn secondary" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? t("common.darkMode") : t("common.lightMode")}
        </button>
        <button onClick={logout} className="btn btn-danger">
          {t("common.logout")}
        </button>
      </aside>
      <main className="content">
        <Outlet />
      </main>

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
    </div>
  );
};
