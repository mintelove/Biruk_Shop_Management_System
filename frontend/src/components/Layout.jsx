import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { ChangeCredentialsModal } from "./ChangeCredentialsModal";
import { useNotifications } from "../context/NotificationContext";
import { InAppToasts, NotificationPanel } from "./NotificationUI";

// Clean professional SVGs for sidebar navigation
const DashboardIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ProductsIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const SalesIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const ProfitIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const AboutIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const SunIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const BellIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const BrandLogo = () => (
  <div className="brand-logo-badge">
    <span className="brand-logo-text">S</span>
  </div>
);

export const Layout = () => {
  const { user, logout } = useAuth();
  const { t, language, switchLanguage } = useI18n();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showCredModal, setShowCredModal] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const getRoleLabel = () => {
    if (user?.role === "admin") return t("common.admin");
    if (user?.role === "purchaser") return t("common.purchaser");
    return t("common.salesman");
  };

  const getUserInitial = () => {
    return (user?.name?.charAt(0) || "U").toUpperCase();
  };

  const navItems = [
    ...(user?.role !== "purchaser"
      ? [{ path: "/", label: t("nav.dashboard"), icon: <DashboardIcon /> }]
      : []),
    { path: "/products", label: t("nav.products"), icon: <ProductsIcon /> },
    ...(user?.role !== "purchaser"
      ? [{ path: "/sales", label: t("nav.sales"), icon: <SalesIcon /> }]
      : []),
    { path: "/purchases", label: t("nav.purchases") || "Profit", icon: <ProfitIcon /> },
    ...(isAdmin
      ? [{ path: "/users", label: t("nav.users"), icon: <UsersIcon /> }]
      : []),
    ...(isAdmin
      ? [{ path: "/settings", label: t("nav.settings"), icon: <SettingsIcon /> }]
      : []),
    { path: "/about", label: t("nav.about"), icon: <AboutIcon /> }
  ];

  return (
    <div className="app-shell">
      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <div className="mobile-header-brand">
          <BrandLogo />
          <span className="mobile-brand-title">{t("app.title")}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="mobile-theme-btn notification-bell-btn"
            onClick={() => setNotifPanelOpen(true)}
            aria-label="Notifications"
            title="Notifications"
            style={{ position: "relative" }}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="notification-bell-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="mobile-theme-btn"
            onClick={() => setShowCredModal(true)}
            aria-label="Change credentials"
            title="My Account / Change Password"
            style={{ fontWeight: 700, fontSize: "0.85rem" }}
          >
            {getUserInitial()}
          </button>
          <button
            type="button"
            className="mobile-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === "light" ? t("common.darkMode") : t("common.lightMode")}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop hover expand/collapse + Mobile slide-out drawer) */}
      <aside
        className={`sidebar ${isHovered ? "sidebar--expanded" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Main Navigation"
      >
        {/* Mobile Close Button (shown only in mobile drawer) */}
        <div className="sidebar-mobile-close-wrap">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Sidebar Header / Brand */}
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <BrandLogo />
          </div>
          <div className="sidebar-brand-text">
            <h2 className="sidebar-title">{t("app.title")}</h2>
            <span className="sidebar-subtitle">Sunlight Electric</span>
          </div>
        </div>

        {/* User Card - Clickable to change own credentials */}
        <div
          className="sidebar-user-card"
          onClick={() => setShowCredModal(true)}
          style={{ cursor: "pointer" }}
          title="Click to update your username or password"
        >
          <div className="user-avatar-circle" title={user?.name || "User"}>
            {getUserInitial()}
          </div>
          <div className="user-details">
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span className="user-name" title={user?.name}>
                {user?.name || "User"}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="user-role-badge">{getRoleLabel()}</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                title={item.label}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className="sidebar-link-label">{item.label}</span>
                {isActive && <span className="sidebar-active-indicator" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          {/* Language Toggle Button */}
          <button
            type="button"
            className="sidebar-action-btn lang-toggle-btn"
            onClick={() => switchLanguage(language === "en" ? "am" : "en")}
            title={language === "en" ? "አማርኛ (Amharic)" : "English"}
          >
            <span className="sidebar-action-icon" style={{ fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.02em" }}>
              {language === "en" ? "አማ" : "EN"}
            </span>
            <span className="sidebar-action-label">
              {language === "en" ? "ቋንቋ: አማርኛ" : "Language: English"}
            </span>
          </button>

          <button
            type="button"
            className="sidebar-action-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "light" ? t("common.darkMode") : t("common.lightMode")}
          >
            <span className="sidebar-action-icon">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className="sidebar-action-label">
              {theme === "light" ? t("common.darkMode") : t("common.lightMode")}
            </span>
          </button>

          <button
            type="button"
            className="sidebar-action-btn notification-bell-btn"
            onClick={() => setNotifPanelOpen(true)}
            title={unreadCount > 0 ? `${unreadCount} notifications` : "Notifications"}
          >
            <span className="sidebar-action-icon" style={{ position: "relative" }}>
              <BellIcon />
              {unreadCount > 0 && (
                <span className="notification-bell-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span className="sidebar-action-label">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="sidebar-action-btn logout-btn"
            title={t("common.logout")}
          >
            <span className="sidebar-action-icon">
              <LogoutIcon />
            </span>
            <span className="sidebar-action-label">{t("common.logout")}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content">
        <Outlet />
      </main>

      {/* User Account - Change Own Username & Password Modal */}
      <ChangeCredentialsModal
        isOpen={showCredModal}
        onClose={() => setShowCredModal(false)}
      />

      {/* Real-time In-App Notifications */}
      <InAppToasts />
      <NotificationPanel
        isOpen={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
      />
    </div>
  );
};
