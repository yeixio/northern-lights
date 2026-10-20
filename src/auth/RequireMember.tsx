import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import Spinner from "../components/Spinner";

/** Gate for the private network: signed in and approved. */
export function RequireMember() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!profile || !profile.is_approved) return <Navigate to="/pending" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  const { profile } = useAuth();
  if (!profile?.is_admin) return <Navigate to="/app" replace />;
  return <Outlet />;
}
