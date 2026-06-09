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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateTeamMutation } from "@/data/teams/teamsData.app";
import {
  getOnboardingStepTitle,
  OnboardingStep,
  ONBOARDING_TOTAL_STEPS,
  onboardingStepLookup,
} from "@/features/onboarding/onboardingState";
import { OnboardingProgress } from "@/features/onboarding/onboardingProgress";
import { authClient } from "@/lib/auth-client";
import { detectedTimeZone, resolveTimeZoneFromCoordinates } from "@/lib/time-zone";
import { revalidateLogic } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Church,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_onboarding/onboarding")({
  component: OnboardingRoute,
  validateSearch: Schema.standardSchemaV1(
    Schema.Struct({
      step: Schema.optional(OnboardingStep),
    }),
  ),
});

const DEFAULT_INITIAL_TEAMS = ["Worship", "Care", "Operations"];

const ChurchProfileSchema = Schema.Struct({
  city: Schema.String,
  countryCode: Schema.String,
  location: Schema.Union(
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
  ),
  name: Schema.String.pipe(Schema.minLength(2, { message: () => "Church name is required." })),
  size: Schema.String,
  state: Schema.String,
  street: Schema.String,
  url: Schema.String,
  zip: Schema.String,
  churchTimeZone: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Church Time Zone is required." }),
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

type InitialTeamDraft = {
  readonly id: string;
  readonly name: string;
};

function OnboardingRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { refetch: refetchSession } = authClient.useSession();
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const createTeam = useCreateTeamMutation();
  const [error, setError] = useState<string | null>(null);
  const [churchProfile, setChurchProfile] = useState<ChurchProfileValue | null>(null);
  const [churchEntryMode, setChurchEntryMode] = useState<"search" | "manual">(
    activeChurch?.name ? "manual" : "search",
  );
  const [profileReady, setProfileReady] = useState<boolean>(Boolean(activeChurch?.name));
  const [initialTeams, setInitialTeams] = useState<readonly InitialTeamDraft[]>(() =>
    DEFAULT_INITIAL_TEAMS.map((name) => ({ id: crypto.randomUUID(), name })),
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!loading && activeChurch?.completedOnboarding) {
      void navigate({ to: "/my-work" });
    }
  }, [activeChurch, loading, navigate]);

  const defaultValues: ChurchProfileValue = {
    city: activeChurch?.city ?? "",
    countryCode: activeChurch?.countryCode ?? "",
    location: null,
    name: activeChurch?.name ?? "",
    size: activeChurch?.size ?? "",
    state: activeChurch?.state ?? "",
    street: activeChurch?.street ?? "",
    url: activeChurch?.url ?? "",
    zip: activeChurch?.zip ?? "",
    churchTimeZone: activeChurch?.churchTimeZone ?? detectedTimeZone(),
  };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ChurchProfileSchema),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setChurchProfile(value);
      await setStep({ _tag: "initialTeams" });
    },
  });

  const requestedStep: OnboardingStep = search.step ?? { _tag: "churchProfile" };
  const step: OnboardingStep =
    requestedStep._tag === "initialTeams" && !churchProfile
      ? { _tag: "churchProfile" }
      : requestedStep;

  const setStep = async (newStep: OnboardingStep) => {
    await navigate({
      search: { step: newStep },
      to: "/onboarding",
    });
  };

  const completeOnboarding = async () => {
    if (!churchProfile) {
      void setStep({ _tag: "churchProfile" });
      return;
    }

    setError(null);
    setIsCompleting(true);

    try {
      const teamNames = uniqueTrimmedTeamNames(initialTeams.map((team) => team.name));
      const trimmedName = churchProfile.name.trim();
      const slug = churchSlug(trimmedName);

      if (!slug) {
        setError("Church name is required.");
        void setStep({ _tag: "churchProfile" });
        return;
      }

      const profile = {
        churchTimeZone: churchProfile.churchTimeZone.trim(),
        city: optionalString(churchProfile.city),
        completedOnboarding: false,
        countryCode: optionalString(churchProfile.countryCode),
        latitude: churchProfile.location?.latitude ?? activeChurch?.latitude ?? undefined,
        longitude: churchProfile.location?.longitude ?? activeChurch?.longitude ?? undefined,
        size: optionalString(churchProfile.size),
        state: optionalString(churchProfile.state),
        street: optionalString(churchProfile.street),
        url: optionalString(churchProfile.url),
        zip: optionalString(churchProfile.zip),
      };

      const result = activeChurch
        ? await authClient.organization.update({
            data: {
              name: trimmedName,
              slug,
              ...profile,
            },
            organizationId: activeChurch.id,
          })
        : await authClient.organization.create({
            name: trimmedName,
            slug,
            ...profile,
          });

      if (result.error) {
        setError(result.error.message ?? "Could not save Church profile.");
        return;
      }

      const organizationId = activeChurch?.id ?? result.data?.id;
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

      for (const name of teamNames) {
        const teamResult = await createTeam({ churchId: organizationId, name });
        if ("error" in teamResult) {
          setError(teamResult.error.message);
          return;
        }
      }

      const completeResult = await authClient.completeOnboarding({ orgId: organizationId });
      if (completeResult.error) {
        setError(completeResult.error.message ?? "Could not complete Church onboarding.");
        return;
      }

      await refetchSession();

      toast.success("Church setup complete.");
      await navigate({ to: "/my-work" });
    } finally {
      setIsCompleting(false);
    }
  };

  const addTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;

    setInitialTeams((teams) => [...teams, { id: crypto.randomUUID(), name }]);
    setNewTeamName("");
  };

  const updateTeamName = (teamId: string, name: string) => {
    setInitialTeams((teams) =>
      teams.map((team) => (team.id === teamId ? { ...team, name } : team)),
    );
  };

  const removeTeam = (teamId: string) => {
    setInitialTeams((teams) => teams.filter((team) => team.id !== teamId));
  };

  const teamNames = uniqueTrimmedTeamNames(initialTeams.map((team) => team.name));
  const currentStepNumber = onboardingStepLookup[step._tag];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading Church profile...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col items-start gap-4 md:m-auto md:max-h-[90%]">
      <OnboardingProgress currentStep={currentStepNumber} totalSteps={ONBOARDING_TOTAL_STEPS} />

      <div className="m-auto flex w-full flex-col gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-background p-0 shadow-2xl">
        <div className="flex flex-col space-y-1.5 p-4 text-left">
          <span className="font-semibold text-lg leading-none tracking-tight">
            <span className="inline-flex flex-row items-center">
              {step._tag === "churchProfile" ? (
                <Church className="mr-2 size-4" />
              ) : (
                <UsersRound className="mr-2 size-4" />
              )}
              {getOnboardingStepTitle(step)}
            </span>
          </span>
        </div>

        <Separator />

        {step._tag === "initialTeams" ? (
          <InitialTeamsStep
            addTeam={addTeam}
            error={error}
            initialTeams={initialTeams}
            isCompleting={isCompleting}
            newTeamName={newTeamName}
            onBack={() => {
              setError(null);
              void setStep({ _tag: "churchProfile" });
            }}
            onComplete={completeOnboarding}
            removeTeam={removeTeam}
            setNewTeamName={setNewTeamName}
            teamNames={teamNames}
            updateTeamName={updateTeamName}
          />
        ) : (
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
                      {(field) => <field.InputField label="Church Name" required />}
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
                        type="submit"
                      >
                        Continue to Teams
                        <ArrowRight />
                      </Button>
                    )}
                  </form.Subscribe>
                </ActionRow>
              </div>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}

type InitialTeamsStepProps = {
  readonly addTeam: () => void;
  readonly error: string | null;
  readonly initialTeams: readonly InitialTeamDraft[];
  readonly isCompleting: boolean;
  readonly newTeamName: string;
  readonly onBack: () => void;
  readonly onComplete: () => void;
  readonly removeTeam: (teamId: string) => void;
  readonly setNewTeamName: (value: string) => void;
  readonly teamNames: readonly string[];
  readonly updateTeamName: (teamId: string, name: string) => void;
};

function InitialTeamsStep({
  addTeam,
  error,
  initialTeams,
  isCompleting,
  newTeamName,
  onBack,
  onComplete,
  removeTeam,
  setNewTeamName,
  teamNames,
  updateTeamName,
}: InitialTeamsStepProps) {
  const hasTeams = initialTeams.length > 0;

  return (
    <div className="flex flex-col gap-4 overflow-hidden p-4">
      <Card className="w-full overflow-hidden">
        <CardHeader className="items-center sm:items-start">
          <CardAdornment className="row-span-1 mr-2 self-center sm:row-span-2 sm:self-start">
            <Building2 className="size-5" />
          </CardAdornment>
          <CardTitle className="self-center sm:self-start">Teams</CardTitle>
          <CardAction className="row-span-1 self-center sm:row-span-2 sm:self-start">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="new-team-name">
                New Team Name
              </label>
              <input
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-44"
                id="new-team-name"
                onChange={(event) => setNewTeamName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTeam();
                  }
                }}
                placeholder="Add a Team"
                value={newTeamName}
              />
              <Button onClick={addTeam} type="button" variant="outline">
                <Plus />
                Add Team
              </Button>
            </div>
          </CardAction>
          <CardDescription className="col-span-2 col-start-2 sm:col-span-1">
            Review the starting Teams Church Task will create for your Church.
          </CardDescription>
        </CardHeader>

        {hasTeams ? (
          <ScrollArea className="max-h-[42dvh] p-0 px-4">
            <div className="flex flex-col gap-2 pb-4" aria-label="Initial Teams">
              {initialTeams.map((team, index) => (
                <div
                  className="flex flex-row items-center gap-3 rounded-lg border px-4 py-3 shadow-sm"
                  key={team.id}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UsersRound className="size-5" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <label className="sr-only" htmlFor={`initial-team-${team.id}`}>
                      Team {index + 1} Name
                    </label>
                    <input
                      className="h-8 w-full rounded-md border border-transparent bg-transparent px-0 font-semibold text-sm outline-none transition-colors focus:border-input focus:bg-background focus:px-2 focus:ring-2 focus:ring-ring/40"
                      id={`initial-team-${team.id}`}
                      onChange={(event) => updateTeamName(team.id, event.target.value)}
                      value={team.name}
                    />
                    <p className="-mt-1 text-muted-foreground text-sm">Initial Church Task Team</p>
                  </div>

                  <div className="ml-auto flex gap-1">
                    <Button
                      aria-label={`Remove ${team.name || `Team ${index + 1}`}`}
                      onClick={() => removeTeam(team.id)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : null}
      </Card>

      <p className="text-sm text-muted-foreground">
        {teamNames.length === 0
          ? "You can skip this and create Teams later in settings."
          : `${teamNames.length} Team${teamNames.length === 1 ? "" : "s"} will be created.`}
      </p>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ActionRow className="-mx-4 -mb-4 w-[calc(100%+2rem)] justify-between">
        <Button disabled={isCompleting} onClick={onBack} type="button" variant="outline">
          <ArrowLeft />
          Back
        </Button>
        <Button
          loading={isCompleting}
          onClick={onComplete}
          type="button"
          variant={hasTeams ? "default" : "ghost"}
        >
          {hasTeams ? (
            <>
              Enter Church Task
              <ArrowRight />
            </>
          ) : (
            "Skip"
          )}
        </Button>
      </ActionRow>
    </div>
  );
}

function uniqueTrimmedTeamNames(names: readonly string[]) {
  const seen = new Set<string>();

  return names.flatMap((name) => {
    const trimmed = name.trim();
    const key = trimmed.toLocaleLowerCase();
    if (!trimmed || seen.has(key)) return [];

    seen.add(key);
    return [trimmed];
  });
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
