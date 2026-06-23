import type { CompositeAddressValue } from "@/components/form/address-location-field";
import { Form } from "@/components/form/form";
import { useAppForm } from "@/components/form/ts-form";
import { ActionRow } from "@/components/ui/action-row";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardAdornment,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamAvatar } from "@/components/avatars/teamAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useDeleteOnboardingTeamMutation,
  useOnboardingTeamsCollection,
  type OnboardingTeamCollectionItem,
} from "@/data/teams/onboardingTeamsData.app";
import { useQuickActionOpeners } from "@/features/quick-actions/quick-actions-state";
import {
  getOnboardingStepTitle,
  OnboardingStep,
  ONBOARDING_TOTAL_STEPS,
  onboardingStepLookup,
  resolveOnboardingStep,
} from "@/features/onboarding/onboardingState";
import { OnboardingKeyDatesReview } from "@/features/onboarding/onboardingKeyDates";
import { OnboardingProgress } from "@/features/onboarding/onboardingProgress";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { authClient } from "@/lib/auth-client";
import { detectedTimeZone, resolveTimeZoneFromCoordinates } from "@/lib/time-zone";
import { revalidateLogic } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { ArrowRight, Church, PartyPopper, Pencil, Plus, Search, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_onboarding/onboarding")({
  component: OnboardingRoute,
  validateSearch: Schema.toStandardSchemaV1(
    Schema.Struct({
      step: Schema.optional(OnboardingStep),
    }),
  ),
});

const ChurchProfileSchema = Schema.Struct({
  city: Schema.String,
  countryCode: Schema.String,
  location: Schema.Union([
    Schema.Null,
    Schema.Struct({
      city: Schema.optional(Schema.String),
      countryCode: Schema.optional(Schema.String),
      latitude: Schema.optional(Schema.Number),
      longitude: Schema.optional(Schema.Number),
      name: Schema.optional(Schema.String),
      state: Schema.optional(Schema.String),
      street: Schema.optional(Schema.String),
      url: Schema.optional(Schema.String),
      zip: Schema.optional(Schema.String),
    }),
  ]),
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(2, { message: "Church name is required." })),
  ),
  size: Schema.String,
  state: Schema.String,
  street: Schema.String,
  url: Schema.String,
  zip: Schema.String,
  churchTimeZone: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1, { message: "Church Time Zone is required." })),
  ),
});

type ChurchProfileValue = {
  readonly city: string;
  readonly countryCode: string;
  readonly location: CompositeAddressValue | null;
  readonly name: string;
  readonly size: string;
  readonly state: string;
  readonly street: string;
  readonly url: string;
  readonly zip: string;
  readonly churchTimeZone: string;
};

function OnboardingRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { activeChurch, sessionActiveChurchId } = useAuthGuard({ redirectIfOnboarded: true });

  const activeChurchForStep =
    activeChurch ?? (sessionActiveChurchId ? { completedOnboarding: false } : null);
  const step = resolveOnboardingStep({ urlStep: search.step, activeChurch: activeChurchForStep });
  const currentStepNumber = onboardingStepLookup[step._tag];

  const setStep = async (newStep: OnboardingStep) => {
    await navigate({
      search: { step: newStep },
      to: "/onboarding",
    });
  };

  return (
    <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col items-start gap-4 md:m-auto md:max-h-[90%]">
      <OnboardingProgress currentStep={currentStepNumber} totalSteps={ONBOARDING_TOTAL_STEPS} />

      <div className="m-auto flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-background p-0 shadow-2xl">
        <div className="flex flex-col space-y-1.5 p-4 text-left">
          <span className="font-semibold text-lg leading-none tracking-tight">
            <span className="inline-flex flex-row items-center">
              {step._tag === "churchProfile" ? (
                <Church className="mr-2 size-4" />
              ) : step._tag === "initialTeams" ? (
                <UsersRound className="mr-2 size-4" />
              ) : (
                <PartyPopper className="mr-2 size-4" />
              )}
              {getOnboardingStepTitle(step)}
            </span>
          </span>
        </div>

        <Separator />

        {step._tag === "churchProfile" ? (
          <ChurchProfileStepCard />
        ) : step._tag === "initialTeams" && activeChurch ? (
          <InitialTeamsStepCard
            churchId={activeChurch!.id}
            onComplete={() => setStep({ _tag: "finished" })}
          />
        ) : step._tag === "finished" && activeChurch ? (
          <FinishedStepCard churchId={activeChurch!.id} />
        ) : null}
      </div>
    </div>
  );
}

function ChurchProfileStepCard() {
  const { refetch: refetchSession } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [churchEntryMode, setChurchEntryMode] = useState<"search" | "manual">("search");
  const [profileReady, setProfileReady] = useState(false);

  const defaultValues: ChurchProfileValue = {
    city: "",
    countryCode: "",
    location: null,
    name: "",
    size: "",
    state: "",
    street: "",
    url: "",
    zip: "",
    churchTimeZone: detectedTimeZone(),
  };

  const createChurch = async (value: ChurchProfileValue) => {
    setError(null);

    const trimmedName = value.name.trim();
    const slug = churchSlug(trimmedName);

    if (!slug) {
      setError("Church name is required.");
      return;
    }

    const result = await authClient.organization.create({
      name: trimmedName,
      slug,
      churchTimeZone: value.churchTimeZone.trim(),
      city: optionalString(value.city),
      completedOnboarding: false,
      countryCode: optionalString(value.countryCode),
      latitude: value.location?.latitude ?? undefined,
      longitude: value.location?.longitude ?? undefined,
      size: optionalString(value.size),
      state: optionalString(value.state),
      street: optionalString(value.street),
      url: optionalString(value.url),
      zip: optionalString(value.zip),
    });

    if (result.error) {
      setError(result.error.message ?? "Could not save Church profile.");
      return;
    }

    const organizationId = result.data?.id;
    if (!organizationId) {
      setError("Church profile was saved, but the active Church could not be selected.");
      return;
    }

    const activeResult = await authClient.organization.setActive({ organizationId });
    if (activeResult.error) {
      setError(activeResult.error.message ?? "Could not select the active Church.");
      return;
    }

    await refetchSession();
    // No explicit step navigation: resolveOnboardingStep advances to the
    // teams step as soon as the Active Church query reflects the new Church.
    // Navigating here would race that auto-advance and clobber later steps.
  };

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(ChurchProfileSchema),
    },
    onSubmit: ({ value }) => createChurch(value),
  });

  return (
    <div className="flex flex-col gap-4 overflow-hidden p-4">
      <Form form={form}>
        <div className="flex flex-col gap-4">
          {churchEntryMode === "search" ? (
            <div className="flex items-end gap-2">
              <form.AppField name="location">
                {(field) => (
                  <field.AddressLocationField
                    label="Find Your Church"
                    onLocationSelect={(location) => {
                      if (!location) {
                        setProfileReady(false);
                        return;
                      }

                      form.setFieldValue("name", location.name);
                      form.setFieldValue("street", location.street ?? "");
                      form.setFieldValue("city", location.city ?? "");
                      form.setFieldValue("state", location.state ?? "");
                      form.setFieldValue("zip", location.postcode ?? "");
                      form.setFieldValue("countryCode", location.countrycode ?? "");
                      form.setFieldValue("url", location.url ?? "");
                      setProfileReady(true);

                      void resolveTimeZoneFromCoordinates(
                        location.coordinates.latitude,
                        location.coordinates.longitude,
                      ).then((timeZone) => {
                        form.setFieldValue("churchTimeZone", timeZone);
                      });
                    }}
                    placeholder="Search for your church on Google Maps"
                  />
                )}
              </form.AppField>
              <Button
                className="ml-auto shrink-0"
                data-testid="onboarding-enter-manually"
                onClick={() => setChurchEntryMode("manual")}
                type="button"
                variant="ghost"
              >
                <Pencil />
                Enter manually
              </Button>
            </div>
          ) : null}

          {churchEntryMode === "manual" || profileReady ? (
            <div className="relative flex flex-col gap-4">
              {churchEntryMode === "manual" ? (
                <Button
                  className="absolute top-0 right-0"
                  data-testid="onboarding-search-instead"
                  onClick={() => {
                    setChurchEntryMode("search");
                    setProfileReady(false);
                  }}
                  type="button"
                  variant="ghost"
                >
                  <Search />
                  Search instead
                </Button>
              ) : null}

              <form.AppField name="name">
                {(field) => (
                  <field.InputField
                    autoComplete="off"
                    data-1p-ignore="true"
                    label="Church Name"
                    required
                  />
                )}
              </form.AppField>

              <form.AppField name="churchTimeZone">
                {(field) => (
                  <field.InputField
                    label="Church Time Zone"
                    placeholder="America/New_York"
                    required
                  />
                )}
              </form.AppField>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <ActionRow className="-mx-4 -mb-4 w-[calc(100%+2rem)]">
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  className="ml-auto"
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onClick={() => {
                    void form.handleSubmit();
                  }}
                  type="button"
                >
                  Next
                  <ArrowRight />
                </Button>
              )}
            </form.Subscribe>
          </ActionRow>
        </div>
      </Form>
    </div>
  );
}

function InitialTeamsStepCard(props: {
  readonly churchId: string;
  readonly onComplete: () => Promise<void>;
}) {
  const { teamsCollection } = useOnboardingTeamsCollection({ churchId: props.churchId });
  const deleteTeam = useDeleteOnboardingTeamMutation();
  const { openCreateTeam, openEditTeam } = useQuickActionOpeners();

  const teams = [...teamsCollection].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const hasTeams = teams.length > 0;

  const removeTeam = (team: OnboardingTeamCollectionItem) => {
    void deleteTeam({ churchId: props.churchId, teamId: team.id }).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not remove Team.");
    });
  };

  return (
    <div className="flex flex-col gap-4 overflow-hidden p-4">
      <Card className="w-full overflow-hidden pb-0">
        <CardHeader className="items-center sm:items-start">
          <CardAdornment className="row-span-1 mr-2 self-center sm:row-span-2 sm:self-start">
            <UsersRound className="size-5" />
          </CardAdornment>
          <CardTitle className="self-center sm:self-start">Teams</CardTitle>
          <CardAction className="row-span-1 self-center sm:row-span-2 sm:self-start">
            <Button
              onClick={() => openCreateTeam({ churchId: props.churchId })}
              type="button"
              variant="outline"
            >
              <Plus />
              Add Team
            </Button>
          </CardAction>
          <CardDescription className="col-span-2 col-start-2 sm:col-span-1">
            Review the starting Teams Church Work created for your Church.
          </CardDescription>
        </CardHeader>

        {hasTeams ? (
          <ScrollArea className="p-0 px-4">
            <div className="flex flex-col gap-2 pb-4" aria-label="Initial Teams">
              {teams.map((team, index) => (
                <div
                  className="flex flex-row items-center gap-3 rounded-lg border px-4 py-3 shadow-sm"
                  key={team.id}
                >
                  <TeamAvatar color={team.color} name={team.name} size={44} />

                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-sm text-muted-foreground">{team.identifier}</p>
                  </div>

                  <div className="ml-auto flex gap-1">
                    <Button
                      aria-label={`Edit ${team.name || `Team ${index + 1}`}`}
                      onClick={() => openEditTeam({ churchId: props.churchId, teamId: team.id })}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      aria-label={`Remove ${team.name || `Team ${index + 1}`}`}
                      disabled={teams.length <= 1}
                      onClick={() => removeTeam(team)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            Add at least one Team to continue onboarding.
          </div>
        )}
      </Card>

      <ActionRow className="-mx-4 -mb-4 w-[calc(100%+2rem)]">
        <Button
          className="ml-auto"
          disabled={!hasTeams}
          onClick={() => void props.onComplete()}
          type="button"
          variant="default"
        >
          Next
          <ArrowRight />
        </Button>
      </ActionRow>
    </div>
  );
}

function FinishedStepCard(props: { readonly churchId: string }) {
  const { refetch: refetchSession } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboarding = async () => {
    setError(null);
    setIsCompleting(true);

    try {
      const result = await authClient.completeOnboarding({ orgId: props.churchId });
      if (result.error) {
        setError(result.error.message ?? "Could not complete Church onboarding.");
        return;
      }

      await refetchSession();
      // The redirectIfOnboarded guard navigates into the product once the
      // Active Church query reflects Completed Onboarding.
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 overflow-hidden p-4">
      <p className="text-sm text-muted-foreground">
        Your Church profile and Teams are ready, and we seeded a starting set of Key Dates. You can
        fine-tune everything later in settings.
      </p>

      <OnboardingKeyDatesReview churchId={props.churchId} />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ActionRow className="-mx-4 -mb-4 w-[calc(100%+2rem)]">
        <Button
          className="ml-auto"
          loading={isCompleting}
          onClick={() => void completeOnboarding()}
          type="button"
        >
          Enter Church Work
          <ArrowRight />
        </Button>
      </ActionRow>
    </div>
  );
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function churchSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
