import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader } from "./PageLoader";

export const ProtectedRoute = ({ roles, children }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader loading={true} message="Please wait while session is being verified." />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};
