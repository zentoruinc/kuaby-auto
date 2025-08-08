import { authClient } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function useAuthProtection() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session && !isPending) {
      navigate({
        to: "/",
      });
    }
  }, [session, isPending, navigate]);

  return {
    session,
    isPending,
    isAuthenticated: !!session,
  };
}
