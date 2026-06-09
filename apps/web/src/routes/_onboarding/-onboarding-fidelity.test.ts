import { describe, expect, test } from "bun:test";

const routeSource = await Bun.file(new URL("./route.tsx", import.meta.url)).text();
const onboardingSource = await Bun.file(new URL("./onboarding.tsx", import.meta.url)).text();

describe("onboarding PreachX fidelity guards", () => {
  test("removes the mismatched generated onboarding chrome", () => {
    expect(routeSource).not.toContain("Next up");
    expect(onboardingSource).not.toContain("Step 1 of 2");
    expect(onboardingSource).not.toContain("Step 2 of 2");
  });

  test("renders the PreachX desktop top-right theme/user controls", () => {
    expect(routeSource).toContain("top-4 right-4 hidden flex-row items-center gap-2 md:flex");
  });

  test("keeps the copied PreachX onboarding frame spacing", () => {
    expect(routeSource).toContain(
      "flex h-[100dvh] w-full shrink-0 flex-col overflow-hidden bg-black md:flex-row dark:bg-cream",
    );
    expect(routeSource).toContain("mt-4 flex flex-col gap-4 pb-2 md:mt-24 md:pb-0");
    expect(routeSource).not.toContain("mt-8 flex flex-col gap-4 pb-2 md:mt-24 md:pb-0");
    expect(onboardingSource).toContain(
      "mx-auto flex max-h-full w-full max-w-2xl flex-col items-start gap-4 md:m-auto md:max-h-[90%]",
    );
    expect(onboardingSource).toContain(
      "m-auto flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-background p-0 shadow-2xl",
    );
  });

  test("keeps PreachX shell-level quick actions mounted in onboarding", () => {
    expect(routeSource).toContain(
      'import { QuickActions } from "@/features/quick-actions/quick-actions";',
    );
    expect(routeSource).toContain("<QuickActions />");
    expect(routeSource.indexOf("<Outlet />")).toBeLessThan(routeSource.indexOf("<QuickActions />"));
  });

  test("keeps onboarding step navigation URL-addressed like PreachX", () => {
    expect(onboardingSource).toContain("validateSearch: Schema.standardSchemaV1");
    expect(onboardingSource).toContain("const search = Route.useSearch();");
    expect(onboardingSource).toContain("search: { step: newStep }");
    expect(onboardingSource).not.toContain(
      'const [step, setStep] = useState<OnboardingStep>({ _tag: "churchProfile" })',
    );
  });

  test("keeps manual Church profile details behind an explicit edit affordance", () => {
    expect(onboardingSource).toContain("Find Your Church");
    expect(onboardingSource).toContain("Edit Details");
    expect(onboardingSource).toContain("showProfileDetails ?");
    expect(onboardingSource).toContain("Street");
  });

  test("uses the copied PreachX preachers-step shape for initial Teams", () => {
    expect(onboardingSource).toContain("<CardAdornment");
    expect(onboardingSource).toContain("<CardAction");
    expect(onboardingSource).toContain("<ActionRow");
    expect(onboardingSource).toContain("Initial Church Task Team");
  });
});
