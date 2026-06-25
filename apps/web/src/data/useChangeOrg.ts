import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { getOrgSwitchTarget } from "@/data/org-routing";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";

type ChangeOrgParams = {
  readonly orgId: string;
  readonly completedOnboarding: boolean;
};

export function useChangeOrg() {
  const navigate = useNavigate();
  const [isChangingOrg, setIsChangingOrg] = useState(false);
  const changingOrgRef = useRef(false);
  const { refetch: refetchSession } = useSession();

  const changeOrg = async (params: ChangeOrgParams) => {
    if (changingOrgRef.current) {
      return;
    }

    changingOrgRef.current = true;
    setIsChangingOrg(true);

    const resetChangingState = () => {
      changingOrgRef.current = false;
      setIsChangingOrg(false);
    };

    try {
      const { error } = await authClient.organization.setActive({
        fetchOptions: {
          onSuccess: async () => {
            try {
              await refetchSession();
              await navigate({
                to: getOrgSwitchTarget({ completedOnboarding: params.completedOnboarding }),
              });
              resetChangingState();
            } catch {
              toast.error("Failed to switch Church. Please try again.");
              resetChangingState();
            }
          },
        },
        organizationId: params.orgId,
      });

      if (error) {
        toast.error("Failed to switch Church. Please try again.");
        resetChangingState();
      }
    } catch {
      toast.error("Failed to switch Church. Please try again.");
      resetChangingState();
    }
  };

  return { changeOrg, isChangingOrg };
}
