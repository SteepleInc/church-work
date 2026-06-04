import { SignIn } from "@/features/auth/sign-in";

type SignInFormProps = {
  readonly defaultEmail?: string;
  readonly invitationId?: string;
};

export default function SignInForm({ defaultEmail, invitationId }: SignInFormProps) {
  return <SignIn defaultEmail={defaultEmail} invitationId={invitationId} />;
}
