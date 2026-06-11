import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { useChangeOrg } from "@/data/useChangeOrg";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/accept-invitation/$id")({
  component: InvitationPage,
});

type InvitationStatus = "pending" | "accepted" | "rejected";

type Invitation = {
  readonly organizationName: string;
  readonly organizationSlug?: string | null;
  readonly inviterEmail?: string | null;
  readonly id: string;
  readonly status: "pending" | "accepted" | "rejected" | "canceled";
  readonly email: string;
  readonly expiresAt?: Date | number | string;
  readonly organizationId: string;
  readonly role: string;
  readonly inviterId?: string | null;
};

function InvitationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { changeOrg } = useChangeOrg();
  const orgs = useUserOrgsCollection();
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatus>("pending");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [acceptedOrgId, setAcceptedOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didSwitchOrg = useRef(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      const session = await authClient.getSession();
      if (!session.data?.user) {
        await navigate({ search: { "invitation-id": id }, to: "/sign-in" });
        return;
      }

      const { data, error: fetchError } = await authClient.organization.getInvitation({
        query: { id },
      });

      if (fetchError) {
        if (fetchError.code === "NOT_AUTHENTICATED") {
          await navigate({ search: { "invitation-id": id }, to: "/sign-in" });
          return;
        }

        setError(fetchError.message || "Could not load this Church Invitation.");
        return;
      }

      setInvitation(data as Invitation);
    };

    void fetchInvitation();
  }, [id, navigate]);

  useEffect(() => {
    if (!acceptedOrgId || orgs.loading || didSwitchOrg.current) {
      return;
    }

    const acceptedOrg = orgs.orgsCollection.find((org) => org.id === acceptedOrgId);
    if (!acceptedOrg) {
      return;
    }

    didSwitchOrg.current = true;
    void changeOrg({
      completedOnboarding: acceptedOrg.completedOnboarding,
      orgId: acceptedOrg.id,
    });
  }, [acceptedOrgId, changeOrg, orgs.loading, orgs.orgsCollection]);

  const handleAccept = async () => {
    const { data, error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId: id,
    });

    if (acceptError) {
      setError(acceptError.message || "Could not accept this Church Invitation.");
      toast.error("Failed to accept invitation. Please try again.");
      return;
    }

    const organizationId = data?.invitation.organizationId;
    if (!organizationId) {
      setError("Could not find the invited Church.");
      toast.error("Failed to accept invitation. Please try again.");
      return;
    }

    setInvitationStatus("accepted");
    setAcceptedOrgId(organizationId);
  };

  const handleReject = async () => {
    const { error: rejectError } = await authClient.organization.rejectInvitation({
      invitationId: id,
    });

    if (rejectError) {
      setError(rejectError.message || "Could not decline this Church Invitation.");
      toast.error("Failed to decline invitation. Please try again.");
      return;
    }

    setInvitationStatus("rejected");
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black" />
      <div className="relative z-10 w-full max-w-md">
        {invitation ? (
          <Card>
            <CardHeader>
              <CardTitle>Church Invitation</CardTitle>
              <CardDescription>You have been invited to join a Church</CardDescription>
            </CardHeader>
            <CardContent>
              {invitationStatus === "pending" ? (
                <div className="space-y-4">
                  <p>
                    <strong>{invitation.inviterEmail ?? "A Church Task member"}</strong> invited you
                    to join <strong>{invitation.organizationName}</strong>.
                  </p>
                  <p>
                    This invitation was sent to <strong>{invitation.email}</strong>.
                  </p>
                </div>
              ) : null}
              {invitationStatus === "accepted" ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-center text-2xl font-bold">
                    Welcome to {invitation.organizationName}!
                  </h2>
                  <p className="text-center text-muted-foreground">
                    You have joined this Church. Church Task is switching your active Church now.
                  </p>
                </div>
              ) : null}
              {invitationStatus === "rejected" ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <X className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="text-center text-2xl font-bold">Invitation Declined</h2>
                  <p className="text-center text-muted-foreground">
                    You declined the invitation to join {invitation.organizationName}.
                  </p>
                </div>
              ) : null}
            </CardContent>
            {invitationStatus === "pending" ? (
              <CardFooter className="flex justify-between">
                <Button onClick={handleReject} variant="outline">
                  Decline
                </Button>
                <Button onClick={handleAccept}>Accept Invitation</Button>
              </CardFooter>
            ) : null}
          </Card>
        ) : error ? (
          <InvitationError />
        ) : (
          <InvitationSkeleton />
        )}
      </div>
    </div>
  );
}

function InvitationError() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <CardTitle className="text-xl text-destructive">Invitation Error</CardTitle>
        </div>
        <CardDescription>There was an issue with your Church Invitation.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          The invitation you are trying to access is invalid or unavailable. Check your email for a
          valid invitation or contact the person who sent it.
        </p>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          nativeButton={false}
          render={<Link preload="intent" to="/" />}
          variant="outline"
        >
          Go back home
        </Button>
      </CardFooter>
    </Card>
  );
}

function InvitationSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-[calc(100vw-2rem)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Skeleton className="h-10 w-24" />
      </CardFooter>
    </Card>
  );
}
