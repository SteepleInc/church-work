# Onboarding PreachX Fidelity

Issue: #91

Canonical PreachX sources reviewed:

- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/app/_onboarding/route.tsx`
- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/app/_onboarding/onboarding.tsx`
- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/features/onboarding/onboardingProgress.tsx`
- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/features/onboarding/orgStep.tsx`
- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/features/onboarding/preachersStep.tsx`
- `/Users/izakfilmalter/Projects/PreachX/preach-x/apps/web/src/features/onboarding/onboardingState.ts`

Church Task files checked:

- `apps/web/src/routes/_onboarding/route.tsx`
- `apps/web/src/routes/_onboarding/onboarding.tsx`
- `apps/web/src/features/onboarding/onboardingProgress.tsx`
- `apps/web/src/features/onboarding/onboardingState.ts`

Fidelity verdict: complete for the #91 scoped onboarding repair.

Repairs confirmed:

- The authenticated onboarding shell uses the copied PreachX black/cream split frame, mobile-only top controls, left-panel org switcher placement, and right-panel card host.
- The onboarding shell mounts `QuickActions` as a shell-level sibling after the outlet, matching the cited PreachX route placement.
- The left welcome block now matches PreachX spacing (`mt-4 ... md:mt-24`) while retaining Church Task copy.
- The onboarding page uses the copied PreachX centered progress-plus-card frame, rounded card, separator, and shadow treatment.
- The generated `Step 1 of 2` / `Step 2 of 2` labels and `Next up` card are absent.
- Church Profile starts with the Google Maps lookup as the primary interaction; manual address/profile fields stay behind `Edit Details`.
- Initial Teams follows the copied PreachX preachers-step pattern with card adornment, card action, scroll area rows, and an action row.

Intentional differences:

- PreachX has five onboarding steps for church organizations. Church Task intentionally has two: Church Profile and Initial Teams.
- PreachX copy mentions sermon royalty and preacher setup. Church Task copy uses Church, Teams, and work setup language.
- The onboarding shell now renders PreachX's desktop theme/user controls (`ModeToggle` + `UserMenu`) floating in the top-right of the right panel, matching PreachX exactly so the user avatar and theme toggle are reachable on desktop.

Screenshot/visual acceptance checklist:

- Desktop first step: same split background, left logo/welcome/org-switcher placement, pill progress, and centered rounded card treatment as PreachX.
- Desktop first step: no bottom `Next up` card and no large manual Church profile dump by default.
- Desktop second step: same card/action-row/list treatment as the PreachX preachers step, adapted to Team names.
- Mobile: same stacked shell behavior, mobile top controls, and card spacing as the copied PreachX route.

Verification commands:

- `bun test apps/web/src/features/onboarding/onboardingState.test.ts apps/web/src/routes/_onboarding/-onboarding-fidelity.test.ts`
- `bun run --filter web check-types`
- `bun run test:e2e tests/e2e/onboarding.spec.ts`
