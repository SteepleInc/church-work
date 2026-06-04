import { SignIn } from "@/features/auth/sign-in";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

const signInSearchSchema = Schema.Struct({
  email: Schema.optional(Schema.String),
  "invitation-id": Schema.optional(Schema.String),
});

export const Route = createFileRoute("/_auth/sign-in")({
  component: SignInRoute,
  validateSearch: Schema.standardSchemaV1(signInSearchSchema),
});

function SignInRoute() {
  return <SignIn />;
}
