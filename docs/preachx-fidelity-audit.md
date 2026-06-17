# PreachX Fidelity Audit

Issue: #97  
Parent PRD: #74

This audit compares Church Task's copied PreachX surfaces against the canonical local PreachX repository at `/Users/izakfilmalter/Projects/PreachX/preach-x`.

Current-truth note: this audit predates PRD #164's Postgres/Drizzle/Zero migration. Visual and product-language comparisons remain useful, but old-stack data/auth notes below are historical and are not current implementation guidance.

Verdict summary:

- Complete enough for this audit slice: the required audit report now exists and covers every #97 surface.
- Complete enough to close #97: every remaining source-level mismatch is now either documented as an intentional Church Task difference or delegated to a focused open blocker issue.
- Repair already made in an earlier #97 slice: Church Task now preloads the copied PreachX marketing font files from the root route.
- Remaining implementation work belongs to focused issues #98, #99, #100, #101, and #102 rather than another broad audit loop.

## Onboarding

Canonical PreachX files:

- `apps/web/src/app/_onboarding/route.tsx`
- `apps/web/src/app/_onboarding/onboarding.tsx`
- `apps/web/src/features/onboarding/onboardingProgress.tsx`
- `apps/web/src/features/onboarding/orgStep.tsx`
- `apps/web/src/features/onboarding/preachersStep.tsx`
- `apps/web/src/features/onboarding/onboardingState.ts`

Church Task files:

- `apps/web/src/routes/_onboarding/route.tsx`
- `apps/web/src/routes/_onboarding/onboarding.tsx`
- `apps/web/src/features/onboarding/onboardingProgress.tsx`
- `apps/web/src/features/onboarding/onboardingState.ts`
- `docs/onboarding-preachx-fidelity.md`

Fidelity verdict: pass for the repaired #91 onboarding scope.

#102 repairs:

- The authenticated onboarding shell uses the copied PreachX split-frame structure, left-panel org switcher placement, mobile-only top controls, and right-panel card host.
- `QuickActions` is mounted as a shell-level sibling after the onboarding outlet.
- The onboarding page uses the copied PreachX centered progress/card frame and omits the previous generated step-summary chrome.
- Church Profile starts with Google Maps lookup and keeps manual fields editable behind an explicit edit path.
- Initial Teams follows the copied PreachX preachers-step card/action/list pattern adapted to Teams.

Intentional differences:

- Church Task has two onboarding steps instead of PreachX's five.
- PreachX preacher/sermon copy and data have been replaced by Church/Team setup copy and Church Task's current data stack.

## Auth, Sign-In, And Invitation Accept

Canonical PreachX files:

- `apps/web/src/app/_auth/sign-in.tsx`
- `apps/web/src/features/auth/signIn.tsx`
- `apps/web/src/features/auth/signInEmailForm.tsx`
- `apps/web/src/app/_auth/accept-invitation.$id.tsx`

Church Task files:

- `apps/web/src/routes/_auth/sign-in.tsx`
- `apps/web/src/components/sign-in-form.tsx`
- `apps/web/src/features/auth/sign-in-state.ts`
- `apps/web/src/routes/_auth/accept-invitation.$id.tsx`

Fidelity verdict: needs repair or explicit follow-up.

Repairs confirmed:

- Sign-in search params include `email` and `invitation-id`.
- The human auth UI is OTP-based and preserves invitation context through sign-in.
- Invitation accept/reject states are implemented with Church Task data behavior.

Remaining mismatches:

- Church Task passes route search params into `SignInForm`; PreachX `SignIn` owns the `useSearch` read and session/refetch redirect effect.
- Church Task does not match PreachX `autoSubmit={!!passedOtpEmail}` behavior for a passed email.
- The invitation accept outer layout diverges from PreachX's white/dark masked auth page frame.

Delegated blocker:

- #101 tracks the source-level repair for PreachX auth/sign-in/invitation accept layout and passed-email behavior.

Intentional differences:

- Better Auth, Active Church switching, and Church Task's current data stack replace PreachX's auth/data internals.

## Org App Shell And Frame

Canonical PreachX files:

- `apps/web/src/app/_org/route.tsx`
- `apps/web/src/components/navigation/appNavigation.tsx`
- `apps/web/src/components/ui/sidebar.tsx`

Church Task files:

- `apps/web/src/routes/_org/route.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/navigation/app-navigation.tsx`
- `apps/web/src/components/ui/sidebar.tsx`

Fidelity verdict: pass with intentional data/auth adaptation.

Repairs confirmed:

- The shell uses `SidebarProvider`, `AppNavigation`, `SidebarInset`, the top header, and shell-level overlays in PreachX order: `DetailsPane`, `QuickActions`, `BigActions`, `GlobalSearch`.
- `DetailsPane` is outside `SidebarInset`.
- `_org` retains only `details-pane` through `retainSearchParams(["details-pane"])`.
- The app sidebar uses the PreachX desktop/mobile split, inset treatment, animated sidebar trigger, and copied scroll-area props.

Intentional differences:

- Church Task auth/onboarding gating uses Active Church/session state rather than PreachX `useAuthGuard`.
- Church Task breadcrumbs are local route labels rather than PreachX's breadcrumbs context.

## Sidebar, Navigation, Org Switcher, And User Menu

Canonical PreachX files:

- `apps/web/src/components/navigation/appNavigation.tsx`
- `apps/web/src/components/navigation/orgSwitcher.tsx`
- `apps/web/src/components/navigation/userNav.tsx`
- `apps/web/src/components/navigation/navShared.tsx`
- `apps/web/src/components/navigation/sidebarItem.tsx`
- `apps/web/src/components/navigation/mobileSidebarContent.tsx`

Church Task files:

- `apps/web/src/components/navigation/app-navigation.tsx`
- `apps/web/src/components/org-switcher.tsx`
- `apps/web/src/components/user-menu.tsx`
- `apps/web/src/components/navigation/nav-shared.tsx`
- `apps/web/src/components/navigation/sidebar-item.tsx`
- `apps/web/src/components/navigation/mobile-sidebar-content.tsx`

Fidelity verdict: mostly pass with intentional product-surface adaptation.

Repairs confirmed:

- Sidebar header renders `OrgSwitcher`, `QuickActionsToggle`, and `GlobalSearchToggle` in the copied PreachX structure.
- Bottom sidebar order matches PreachX: dev menu, feedback, home.
- Main/settings/admin/dev navigation items have copied PreachX icons or close equivalents where product-specific icons are required.
- User menu uses an avatar-only trigger and sign-out dropdown matching the PreachX placement.

Intentional differences:

- Church Task nav surfaces are My Work, Our Work, Team Work, Settings, App Admin, and Dev rather than PreachX chat/studio/collections/preachers.
- Mobile sidebar omits PreachX chat-specific view switching because Church Task has no copied chat list.
- Base UI primitives use `render` and `--anchor-width` adaptations where PreachX uses Radix `asChild` and Radix CSS variables.

## Page Containers And Scroll Behavior

Canonical PreachX files:

- `apps/web/src/components/pageComponents.tsx`
- `apps/web/src/app/_org/route.tsx`

Church Task files:

- `apps/web/src/components/pageComponents.tsx`
- `apps/web/src/routes/-dashboard.tsx`
- `apps/web/src/routes/_org/my-work.tsx`
- `apps/web/src/routes/_org/our-work.tsx`
- `apps/web/src/routes/_org/team.$teamId.tsx`

Fidelity verdict: pass for normal app pages.

Repairs confirmed:

- `MainContainer`, `PageContainer`, and related page primitives are copied/adapted.
- My Work, Our Work, and Team Work use the shell/page scroll frame rather than document-level scrolling.

Intentional differences:

- Some internal/dev pages use a local `InternalPageFrame` with `ScrollArea` instead of `PageContainer`; this should remain documented unless visual mismatch is reported.

## Settings

Canonical PreachX files:

- `apps/web/src/app/_org/settings/index.tsx`
- `apps/web/src/app/_org/settings/profile.tsx`
- `apps/web/src/app/_org/settings/org.tsx`
- `apps/web/src/app/_org/settings/team/route.tsx`
- `apps/web/src/app/_org/settings/team/$teamTab.tsx`
- `apps/web/src/features/settings/profileForm.tsx`
- `apps/web/src/features/settings/inviteMemberForm.tsx`

Church Task files:

- `apps/web/src/routes/-settings.tsx`
- `apps/web/src/routes/_org/settings.tsx`
- `apps/web/src/routes/_org/settings.profile.tsx`
- `apps/web/src/routes/_org/settings.org.tsx`
- `apps/web/src/routes/_org/settings.team.tsx`
- `apps/web/src/routes/_org/settings.team.$teamTab.tsx`
- `apps/web/src/features/users/team-tabs.tsx`
- `apps/web/src/features/settings/invite-member.tsx`

Fidelity verdict: pass for the #102 settings/form fidelity repair.

Repairs confirmed:

- Settings navigation lives in the copied sidebar groups.
- Team settings route uses `MainContainer`, `TeamTabs`, and nested outlet behavior.
- Billing, prompts, PreachX integrations, and preacher-specific settings are excluded.

Repairs confirmed:

- Profile and Church settings now compose the copied/adapted `CardForm` primitive rather than raw inline form panels.
- Invite Member now uses the copied/adapted `TagInputField` and `TagInput` shape inside `QuickActionForm` instead of textarea entry.
- `FormErrorDisplay` now uses the copied PreachX alert icon/flex red treatment for submit-level form errors.

Form primitive decisions for #102:

- Active requirement: `CardForm`, because Profile and Church settings are active Church Task settings surfaces.
- Active requirement: `TagInputField`, because Invite Member is active in Settings and Quick Actions and needs PreachX pasted-email tag entry.
- Active requirement: `FormErrorDisplay`, because copied form composition renders it through the shared `Form` primitive.
- Intentional exclusion: avatar/file upload fields, because Church Task has no active profile avatar or Church logo flow in this PRD slice.
- Intentional exclusion: markdown fields, because no active Church Task settings or invite flow needs PreachX markdown input.

## Admin

Canonical PreachX files:

- `apps/web/src/app/_org/admin/index.tsx`
- `apps/web/src/app/_org/admin/route.tsx`
- `apps/web/src/app/_org/admin/orgs.tsx`
- `apps/web/src/app/_org/admin/users.tsx`
- `apps/web/src/components/navigation/adminNav.tsx`
- `apps/web/src/components/navigation/navShared.tsx`
- `apps/web/src/components/pageComponents.tsx`

Church Task files:

- `apps/web/src/routes/_org/admin.tsx`
- `apps/web/src/routes/_org/admin.orgs.tsx`
- `apps/web/src/routes/_org/admin.users.tsx`
- `apps/web/src/components/navigation/adminNav.tsx`
- `apps/web/src/features/orgs/orgsCollection.tsx`
- `apps/web/src/features/users/usersCollection.tsx`
- `apps/web/src/components/collections/collection.tsx`
- `apps/web/src/components/navigation/nav-shared.tsx`
- `apps/web/src/components/navigation/app-navigation.tsx`

Fidelity verdict: pass for available admin surfaces, with global app-admin gating documented as an intentional Church Task difference.

Repairs confirmed:

- `/admin` redirects to `/admin/users`.
- Users and Churches pages use `MainContainer` and copied collection-style components.
- Unsupported PreachX admin entities are not shown.

Intentional difference:

- PreachX gates admin with global `session.user.role === "admin"` and `requireAdmin`; Church Task gates App Administration through the App Administrator role and `useIsAppAdmin`-style helpers, separate from Church Membership admin roles.

Delegated blocker status:

- #95 is closed; the copied collection structure and dedicated admin navigation repair landed there.

## Quick Actions And Big Actions

Canonical PreachX files:

- `apps/web/src/features/quickActions/quickActions.tsx`
- `apps/web/src/features/quickActions/quickActionsToggle.tsx`
- `apps/web/src/features/quickActions/quickActionsState.ts`
- `apps/web/src/features/quickActions/inviteMemberQuickAction.tsx`
- `apps/web/src/features/bigAction/bigActions.tsx`
- `apps/web/src/features/bigAction/bigActionComponents.tsx`
- `apps/web/src/features/bigAction/bigActionState.tsx`

Church Task files:

- `apps/web/src/features/quick-actions/quick-actions.tsx`
- `apps/web/src/features/quick-actions/quick-actions-toggle.tsx`
- `apps/web/src/features/quick-actions/quick-actions-state.ts`
- `apps/web/src/features/settings/invite-member.tsx`
- `apps/web/src/features/big-actions/big-actions.tsx`

Fidelity verdict: quick actions and Invite Member pass for #94; big-action chrome remains delegated to #100.

Repairs confirmed:

- Quick Actions uses a single `Quick Action` command group adapted to Church Task actions.
- Sidebar quick-action toggle matches PreachX collapsed behavior and `mod K` treatment.
- Invite Member uses the copied/adapted `QuickActionsWrapper`, `QuickActionsHeader`, `QuickActionsTitle`, `QuickActionForm`, action-row footer, and PreachX shortcut rendering while preserving Church Task invitation roles and mutations.
- BigActions is mounted at the PreachX shell level and quick actions open big-action state rather than navigating.

Remaining mismatch:

- Church Task big actions use a small `DialogContent className="sm:max-w-xl"` create-task modal. PreachX uses a `BigActionWrapper` with mobile `Drawer` and desktop `FullScreenModal`. This source-level chrome repair is tracked separately by #100 and is no longer a blocker for #94.

Delegated blocker:

- #100 tracks the source-level repair for PreachX full-screen and drawer chrome.

Intentional difference:

- Church Task uses TanStack Hotkeys instead of PreachX `react-hotkeys-hook` as required by #74.

## Global Search

Canonical PreachX files:

- `apps/web/src/features/globalSearch/globalSearch.tsx`
- `apps/web/src/features/globalSearch/globalSearchWindow.tsx`
- `apps/web/src/features/globalSearch/globalSearchToggle.tsx`
- `apps/web/src/features/globalSearch/globalSearchFooter.tsx`

Church Task files:

- `apps/web/src/features/global-search/global-search.tsx`
- `apps/web/src/features/global-search/global-search-toggle.tsx`
- `apps/web/src/features/global-search/global-search-state.ts`
- `apps/web/src/features/global-search/global-search-utils.ts`

Fidelity verdict: needs repair.

Repairs confirmed:

- `GlobalSearch` is mounted at the PreachX shell level after `BigActions`.
- The `/` shortcut opens search and disables quick actions as expected.
- Church Task indexes tasks, teams, members, and routes instead of PreachX product entities.

Remaining mismatches:

- PreachX uses a `QuickActionsWrapper`, Downshift, react-virtual, two-column results/detail panel, and footer keyboard/action row.
- Church Task currently uses a simpler `CommandDialog`/cmdk one-column list.
- `GlobalSearchToggle` includes visible `Search` text and a generic icon, while PreachX's toggle is icon plus `/` kbd with specific `bg-l2` treatment.

Delegated blocker:

- #98 tracks the source-level repair for the PreachX two-pane global search window, footer, and toggle treatment.

## Details Pane

Canonical PreachX files:

- `apps/web/src/components/detailsPane/detailsPane.tsx`
- `apps/web/src/components/detailsPane/detailsPaneHelpers.ts`
- `apps/web/src/components/detailsPane/detailsPaneHistory.tsx`
- `apps/web/src/components/detailsPane/detailsShell.tsx`
- `apps/web/src/components/detailsPane/detailsPaneTypes.ts`

Church Task files:

- `apps/web/src/components/details-pane/details-pane.tsx`
- `apps/web/src/components/details-pane/details-pane-helpers.ts`
- `apps/web/src/components/details-pane/details-shell.tsx`
- `apps/web/src/components/details-pane/details-components.tsx`
- `apps/web/src/components/details-pane/details-pane-types.ts`
- `apps/web/src/features/details-pane/task-details-pane.tsx`
- `apps/web/src/features/details-pane/team-details-pane.tsx`
- `apps/web/src/features/details-pane/org-details-pane.tsx`

Fidelity verdict: needs repair.

Repairs confirmed:

- URL state uses the `details-pane` search param.
- Effect schema parsing, open/close helper shape, and shell-level placement are present.
- Entity content is adapted to task/team/org.

Remaining mismatches:

- Church Task renders a fixed `aside`; PreachX uses responsive mobile `Drawer`, desktop `Dialog`, sticky mode, `ToggleDetailsPaneButton`, `DetailsPaneHistory`, and animated Radix content.
- Church Task `DetailsShell` omits PreachX `MainContainer`, `PageHeaderContainer`, `Divider`, and `tabBar` slot structure.
- `useChangeDetailsPaneId` lacks PreachX ctrl/meta click behavior.

Delegated blocker:

- #99 tracks the source-level repair for the PreachX responsive drawer/dialog/sticky/history shell.

## Marketing Pages And Fonts

Canonical PreachX files:

- `apps/web/src/app/_marketing/route.tsx`
- `apps/web/src/app/_marketing/index.tsx`
- `apps/web/src/app/_marketing/library.tsx`
- `apps/web/src/app/__root.tsx`
- PreachX marketing font files under `public/fonts`

Church Task files:

- `apps/web/src/routes/_marketing/route.tsx`
- `apps/web/src/routes/_marketing/index.tsx`
- `apps/web/src/routes/_marketing/library.tsx`
- `apps/web/src/components/navigation/marketingNavigation.tsx`
- `apps/web/src/components/navigation/mobileMarketingNavigation.tsx`
- `apps/web/src/routes/__root.tsx`
- `apps/web/public/fonts/**`

Fidelity verdict: pass after this slice's font preload repair.

Repairs confirmed:

- Marketing shell, navigation treatment, and PP Neue Montreal / PP Pangaia font files are copied/adapted.
- Church Task now preloads `/fonts/neueMontreal/PPNeueMontreal-Variable.woff2` and `/fonts/pangaia/PPPangaia-Variable.woff2` from the root route like PreachX.

Intentional differences:

- Marketing copy and calls to action are Church Task-specific.
- PreachX canonical/productlane/analytics/root document wiring is not copied because it depends on PreachX runtime/product integrations.

## Form System

Canonical PreachX files:

- `apps/web/src/components/form/form.tsx`
- `apps/web/src/components/form/formErrorDisplay.tsx`
- `apps/web/src/components/form/tsForm.ts`
- `apps/web/src/components/form/tsField.tsx`
- `apps/web/src/components/form/inputPrimitives.tsx`
- `apps/web/src/components/form/*Field.tsx`
- `apps/web/src/features/settings/inviteMemberForm.tsx`

Church Task files:

- `apps/web/src/components/form/form.tsx`
- `apps/web/src/components/form/form-error-display.tsx`
- `apps/web/src/components/form/ts-form.ts`
- `apps/web/src/components/form/ts-field.tsx`
- `apps/web/src/components/form/input-primitives.tsx`
- `apps/web/src/components/form/*-field.tsx`
- `apps/web/src/features/settings/invite-member.tsx`

Fidelity verdict: needs repair or explicit scoped subset decision.

Repairs confirmed:

- Core `Form`/submit behavior is close to PreachX.
- Button loading overlay behavior is present and tested.
- Address, select, combobox, date, switch, textarea, OTP, and entity selection fields exist for active Church Task flows.

Remaining mismatches:

- `FormErrorDisplay` dropped PreachX's alert icon/flex red treatment.
- Several PreachX fields are absent, including `cardForm`, `tagInputField`, `fileDropZoneField`, `avatarUploadField`, and `markdownEditorField`.
- `TagInputField` is relevant to Invite Member fidelity if that flow must exactly match PreachX.

Delegated blocker:

- #102 tracks the CardForm and TagInputField decision/repair for settings and invite-member fidelity.

Intentional differences:

- Omitted file/avatar/markdown fields appear tied to excluded PreachX product surfaces unless a future Church Task flow needs them.

## Primitives

Canonical PreachX files:

- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/command.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/kbd.tsx`
- `apps/web/src/components/ui/sidebar.tsx`
- `apps/web/src/components/ui/scroll-area.tsx`

Church Task files:

- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/command.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/kbd.tsx`
- `apps/web/src/components/ui/sidebar.tsx`
- `apps/web/src/components/ui/scroll-area.tsx`

Fidelity verdict: sidebar/scroll-area mostly pass; command mostly pass; dialog/kbd/button have intentional Base UI divergence and some visible mismatches.

Repairs confirmed:

- Sidebar and scroll-area behavior have been repaired toward PreachX while preserving Church Task's Base UI direction.
- Command menu classes and grouping are close to PreachX.
- Button supports loading without layout shift.

Remaining mismatches:

- `Dialog` uses Base UI instead of PreachX Radix and has different API/classes (`showCloseButton`, `hideOverlay`, close-button handling, overlay/content classes).
- `Kbd` does not implement PreachX shortcut-symbol rendering via `getShortcutKey`, `EnterIcon`, or `PlusIcon`.
- `Button` lacks some PreachX variant/size behavior, including the `overlay` variant and PreachX default/destructive gradient treatment.

Intentional differences:

- #74 explicitly says not to wholesale migrate Church Task primitives to Radix; Base UI-backed primitives are retained unless a copied component needs a surgical compatibility extension.

## Dev And App-Admin Navigation

Canonical PreachX files:

- `apps/web/src/components/navigation/adminNav.tsx`
- `apps/web/src/components/navigation/debugNav.tsx`
- `apps/web/src/components/navigation/devMenu.tsx`
- `apps/web/src/components/navigation/devMenuContent.tsx`
- `apps/web/src/components/navigation/navShared.tsx`

Church Task files:

- `apps/web/src/components/navigation/app-navigation.tsx`
- `apps/web/src/components/navigation/dev-menu.tsx`
- `apps/web/src/components/navigation/dev-menu-content.tsx`
- `apps/web/src/components/navigation/nav-shared.tsx`
- `apps/web/src/components/navigation/internal-navigation.tsx`
- `apps/web/src/routes/_org/dev.session.tsx`
- `apps/web/src/routes/_org/dev.data.tsx`
- `apps/web/src/routes/_org/admin.tsx`
- `apps/web/src/routes/_org/admin.orgs.tsx`
- `apps/web/src/routes/_org/admin.users.tsx`

Fidelity verdict: pass for placement and structure, with one product/auth question.

Repairs confirmed:

- Dev menu sits in the copied PreachX bottom-sidebar position.
- Admin and Dev groups have copied sidebar group styling and active states.
- Dev pages expose Church Task session/data debugging surfaces rather than PreachX product surfaces.
- Admin is intentionally scoped to active-Church owner/admin access until Church Task has a global app-admin role source of truth.

Remaining question:

- None for this admin/dev navigation slice.

## Focused Follow-Ups Delegated From #97

- #98 remains open for Global Search: copy PreachX's two-pane `globalSearchWindow`/footer/toggle structure.
- #99 remains open for Details Pane: copy PreachX responsive drawer/dialog/sticky/history shell.
- #100 remains open for BigActions: copy PreachX `BigActionWrapper` desktop full-screen and mobile drawer chrome.
- #101 remains open for auth/sign-in/invitation layout and passed-email auto-submit fidelity.
- #102 remains open for settings/forms: decide or repair PreachX `CardForm` and `TagInputField` fidelity.

## #97 Closure Status

- The audit deliverable exists and covers every surface listed in #97.
- #95 is closed, and remaining source-level mismatches are delegated to focused open issues #98, #99, #100, #101, and #102.
- The documented Base UI primitive differences remain intentional under #74's instruction not to wholesale migrate primitives to Radix UI.
- No screenshot loop or additional broad audit pass is required before closing #97.
