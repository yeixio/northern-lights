import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import Spinner from "../components/Spinner";

/** Gate for the private network. */
export function RequireMember() {
  const { user, needsSetup, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner full />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  if (!user?.is_admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
