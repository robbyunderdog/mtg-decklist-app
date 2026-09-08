// Route guard: renders the nested routes (via <Outlet />) only once we know there's a logged
// in user; otherwise redirects to /login. Wraps every route except login/register in App.tsx.
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
