import { api } from "@church-task/backend/convex/_generated/api";
import { buttonVariants } from "@church-task/ui/components/button";
import { CheckoutLink, CustomerPortalLink } from "@convex-dev/polar/react";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function PrivateDashboardContent() {
  const privateData = useQuery(api.privateData.get);
  const products = useQuery(api.polar.listAllProducts);
  const subscription = useQuery(api.polar.getCurrentSubscription);

  const product = products?.find((product: { isRecurring?: boolean }) => product.isRecurring);
  const hasActiveSubscription = Boolean(subscription);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>privateData: {privateData?.message}</p>
      <p>Plan: {hasActiveSubscription ? "Active" : "Free"}</p>
      {subscription === undefined ? (
        <p>Loading subscription options...</p>
      ) : hasActiveSubscription ? (
        <CustomerPortalLink polarApi={api.polar} className={buttonVariants({ variant: "outline" })}>
          Manage Subscription
        </CustomerPortalLink>
      ) : products === undefined ? (
        <p>Loading subscription options...</p>
      ) : product ? (
        <CheckoutLink
          polarApi={api.polar}
          productIds={[product.id]}
          embed={false}
          className={buttonVariants({ variant: "default" })}
        >
          Upgrade
        </CheckoutLink>
      ) : (
        <p>No recurring plans available.</p>
      )}
      <UserMenu />
    </div>
  );
}

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <>
      <Authenticated>
        <PrivateDashboardContent />
      </Authenticated>
      <Unauthenticated>
        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </Unauthenticated>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
    </>
  );
}
