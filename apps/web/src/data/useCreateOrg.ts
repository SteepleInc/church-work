import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";

export function useCreateOrg() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = useSession();

  const createOrg = async () => {
    const { error } = await authClient.clearOrgForOnboarding();

    if (error) {
      toast.error("Failed to start Church creation. Please try again.");
      return;
    }

    await refetchSession();
    await navigate({ to: "/onboarding" });
  };

  return { createOrg };
}
