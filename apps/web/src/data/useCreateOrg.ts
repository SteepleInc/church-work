import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function useCreateOrg() {
  const navigate = useNavigate();
  const { refetch: refetchSession } = authClient.useSession();

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
