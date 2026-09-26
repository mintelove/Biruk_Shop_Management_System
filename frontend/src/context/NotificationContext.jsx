import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { getNotificationDestination } from "../utils/notificationNavigation";

const NotificationContext = createContext(null);

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

/**
 * Request browser notification permission once, professionally.
 */
function requestBrowserPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/**
 * Show a native browser notification if permitted.
 */
function showBrowserNotification(title, body, onClick) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body,
      icon: "/logo.jpg",
      badge: "/logo.jpg",
      tag: `notif-${Date.now()}`,
      requireInteraction: false
    });

    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
        notif.close();
      };
    }

    // Auto-close after 6 seconds
    setTimeout(() => notif.close(), 6000);
  } catch {
    // Silent — some environments block Notification constructor
  }
}

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);
  const processedIds = useRef(new Set());
  const toastIdCounter = useRef(0);

  // Fetch notifications from the backend
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/notifications");
      if (res.data?.notifications) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.notifications.filter((n) => !n.isRead).length);
      }
    } catch {
      // Silent
    }
  }, [user]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silent
    }
  }, []);

  // Add an in-app toast notification
  const addToast = useCallback((notification) => {
    const id = ++toastIdCounter.current;
    const toast = {
      id,
      title: notification.title || "Notification",
      message: notification.message || "",
      type: notification.type || "info",
      createdAt: notification.createdAt || new Date().toISOString()
    };

    setToasts((prev) => [...prev.slice(-4), toast]); // Keep max 5

    // Auto-remove after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  // Remove a toast
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Request browser notification permission on first login
  useEffect(() => {
    if (user) {
      requestBrowserPermission();
    }
  }, [user]);

  // Fetch notifications on login
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up Socket.IO listener for real-time notifications
  useEffect(() => {
    if (!user) return;

    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on("notification:new", (data) => {
      // Only process notifications intended for this user
      if (String(data.user_id) !== String(user._id)) return;

      // Duplicate prevention using notification _id
      if (data._id && processedIds.current.has(String(data._id))) return;
      if (data._id) processedIds.current.add(String(data._id));

      // Keep processedIds from growing indefinitely
      if (processedIds.current.size > 200) {
        const entries = [...processedIds.current];
        processedIds.current = new Set(entries.slice(-100));
      }

      // Add to state
      setNotifications((prev) => [data, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);

      // Show in-app toast
      addToast(data);

      // Show browser notification
      const browserTitle = `SunLight Electric — ${data.title || "Notification"}`;
      showBrowserNotification(browserTitle, data.message || "", () => {
        const dest = getNotificationDestination(data, user?.role);
        window.location.hash = "";
        window.location.pathname = dest.path;
        if (dest.search) {
          window.location.search = dest.search;
        }
      });
    });

    return () => {
      socket.off("notification:new");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, addToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        removeToast
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      toasts: [],
      fetchNotifications: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      removeToast: () => {}
    };
  }
  return ctx;
};
