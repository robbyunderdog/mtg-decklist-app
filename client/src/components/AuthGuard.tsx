import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function AuthGuard() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
