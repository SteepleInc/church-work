import { describe, expect, test } from "bun:test";

const authRouteSource = await Bun.file(
  new URL("../../routes/_auth/route.tsx", import.meta.url),
).text();
const signInRouteSource = await Bun.file(
  new URL("../../routes/_auth/sign-in.tsx", import.meta.url),
).text();
const signInSource = await Bun.file(new URL("./sign-in.tsx", import.meta.url)).text();
const signInEmailFormSource = await Bun.file(
  new URL("./sign-in-email-form.tsx", import.meta.url),
).text();
const invitationRouteSource = await Bun.file(
  new URL("../../routes/_auth/accept-invitation.$id.tsx", import.meta.url),
).text();
const authClientSource = await Bun.file(
  new URL("../../lib/auth-client.ts", import.meta.url),
).text();

describe("auth PreachX fidelity guards", () => {
  test("keeps sign-in inside the copied auth layout frame", () => {
    expect(authRouteSource).toContain('createFileRoute("/_auth")');
    expect(authRouteSource).toContain("relative flex h-screen w-full flex-row");
    expect(authRouteSource).toContain("m-auto flex flex-col items-start");
    expect(authRouteSource).toContain("<Outlet />");

    expect(signInRouteSource).toContain("<SignIn />");
    expect(signInRouteSource).not.toContain("min-h-svh");
    expect(signInSource).toContain('className="w-96 max-w-[calc(100vw-2.5rem)]"');
    expect(signInSource).toContain('className="font-medium text-4xl"');
  });

  test("preserves passed email auto-submit and OTP sign-in behavior", () => {
    expect(signInSource).toContain("useSearch({ strict: false })");
    expect(signInSource).toContain('search["invitation-id"]');
    expect(signInSource).toContain("search.email");
    expect(signInSource).toContain("autoSubmit={!!passedOtpEmail}");
    expect(signInSource).toContain("await refetch();");

    expect(signInEmailFormSource).toContain("hasAutoSubmitted");
    expect(signInEmailFormSource).toContain("emailForm.handleSubmit();");
    expect(signInEmailFormSource).toContain("authClient.emailOtp.sendVerificationOtp");
    expect(signInEmailFormSource).toContain('type: "sign-in"');

    expect(authClientSource).toContain("emailOTPClient()");
  });

  test("keeps invitation accept in the copied masked auth presentation", () => {
    expect(invitationRouteSource).toContain("flex min-h-[80vh] items-center justify-center");
    expect(invitationRouteSource).toContain(
      "bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black",
    );
    expect(invitationRouteSource).toContain(
      'navigate({ search: { "invitation-id": id }, to: "/sign-in" })',
    );
    expect(invitationRouteSource).toContain("authClient.organization.acceptInvitation");
    expect(invitationRouteSource).toContain("changeOrg({");
    expect(invitationRouteSource).toContain("Church Invitation");
  });
});
