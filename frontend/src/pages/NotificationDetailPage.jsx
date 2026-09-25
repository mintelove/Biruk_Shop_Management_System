import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "../components/PageLoader";
import { getNotificationDestination } from "../utils/notificationNavigation";

/**
 * NotificationDetailPage
 * Redirects directly to the existing relevant application page (Sales, Products, Purchases, Users).
 * Never displays an empty or intermediate page.
 */
export const NotificationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate(user?.role === "purchaser" ? "/products" : "/", { replace: true });
      return;
    }

    let isMounted = true;

    const resolveAndRedirect = async () => {
      try {
        const res = await api.get(`/notifications/${id}`);
        if (!isMounted) return;

        if (res.data?.notification) {
          const dest = getNotificationDestination(res.data.notification, user?.role);
          navigate(dest.path + (dest.search || ""), { replace: true, state: dest.state });
          return;
        }
      } catch (err) {
        console.warn("Unable to resolve notification details, redirecting to relevant section:", err.message);
      }

      if (!isMounted) return;
      // Fallback: direct to sales or products page
      navigate(user?.role === "purchaser" ? "/products" : "/sales", { replace: true });
    };

    resolveAndRedirect();

    return () => {
      isMounted = false;
    };
  }, [id, user, navigate]);

  return <PageLoader title="Navigating..." message="Directing to relevant page..." />;
};

export default NotificationDetailPage;
