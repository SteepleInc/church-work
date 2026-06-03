import { Form } from "@/components/form/form";
import type { CompositeAddressValue } from "@/components/form/address-location-field";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { useCreateTeamMutation } from "@/data/teams/teamsData.app";
import { authClient } from "@/lib/auth-client";
import { revalidateLogic } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { ArrowLeft, ArrowRight, Church, Plus, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_onboarding/onboarding")({
  component: OnboardingRoute,
});

const CHURCH_SIZE_OPTIONS = [
  { label: "Under 100 people", value: "under_100" },
  { label: "100-250 people", value: "100_250" },
  { label: "251-500 people", value: "251_500" },
  { label: "501-1,000 people", value: "501_1000" },
  { label: "More than 1,000 people", value: "over_1000" },
];

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
  const { refetch: refetchSession } = authClient.useSession();
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const createTeam = useCreateTeamMutation();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"church-profile" | "initial-teams">("church-profile");
  const [churchProfile, setChurchProfile] = useState<ChurchProfileValue | null>(null);
  const [initialTeams, setInitialTeams] = useState<readonly InitialTeamDraft[]>(() =>
    DEFAULT_INITIAL_TEAMS.map((name) => ({ id: crypto.randomUUID(), name })),
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
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
    churchTimeZone: activeChurch?.churchTimeZone ?? detectedChurchTimeZone(),
  };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onDynamic: Schema.standardSchemaV1(ChurchProfileSchema),
    },
    onSubmit: async ({ value }) => {
      setError(null);
      setChurchProfile(value);
      setStep("initial-teams");
    },
  });

  const completeOnboarding = async () => {
    if (!churchProfile) {
      setStep("church-profile");
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
        setStep("church-profile");
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading Church profile...
      </div>
    );
  }

  if (step === "initial-teams") {
    return (
      <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col items-start gap-4 md:m-auto md:max-h-[90%]">
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step 2 of 2</span>
            <span>Initial Teams</span>
          </div>
          <Progress value={100} />
        </div>

        <Card className="w-full overflow-hidden rounded-2xl shadow-2xl">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <UsersRound className="size-5" />
              Review your initial Teams
            </CardTitle>
            <CardDescription>
              These Teams will be created for your Church now. You can rename, remove, or add Teams
              before entering the app.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="max-h-[calc(100dvh-14rem)] overflow-y-auto p-6">
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                You can adjust this starting structure now and continue refining Teams later in
                settings.
              </div>

              <div className="space-y-3" aria-label="Initial Teams">
                {initialTeams.length > 0 ? (
                  initialTeams.map((team, index) => (
                    <div className="flex items-center gap-2" key={team.id}>
                      <label className="sr-only" htmlFor={`initial-team-${team.id}`}>
                        Team {index + 1} Name
                      </label>
                      <input
                        className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        id={`initial-team-${team.id}`}
                        onChange={(event) => updateTeamName(team.id, event.target.value)}
                        value={team.name}
                      />
                      <Button
                        aria-label={`Remove ${team.name || `Team ${index + 1}`}`}
                        onClick={() => removeTeam(team.id)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No Teams will be created yet. Add one now or create Teams later in settings.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="new-team-name">
                  New Team Name
                </label>
                <input
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="new-team-name"
                  onChange={(event) => setNewTeamName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTeam();
                    }
                  }}
                  placeholder="Add a Team, like Students"
                  value={newTeamName}
                />
                <Button onClick={addTeam} type="button" variant="outline">
                  <Plus />
                  Add Team
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {teamNames.length === 0
                  ? "You can continue without creating Teams."
                  : `${teamNames.length} Team${teamNames.length === 1 ? "" : "s"} will be created.`}
              </p>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  disabled={isCompleting}
                  onClick={() => {
                    setError(null);
                    setStep("church-profile");
                  }}
                  type="button"
                  variant="outline"
                >
                  <ArrowLeft />
                  Back
                </Button>
                <Button loading={isCompleting} onClick={completeOnboarding} type="button">
                  Enter Church Task
                  <ArrowRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col items-start gap-4 md:m-auto md:max-h-[90%]">
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step 1 of 2</span>
          <span>Church Profile</span>
        </div>
        <Progress value={50} />
      </div>

      <Card className="w-full overflow-hidden rounded-2xl shadow-2xl">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Church className="size-5" />
            Tell us about your Church
          </CardTitle>
          <CardDescription>
            Search Google Maps to fill your profile quickly, then edit anything that needs a
            correction.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="max-h-[calc(100dvh-14rem)] overflow-y-auto p-6">
          <Form form={form}>
            <form.AppField name="location">
              {(field) => (
                <field.AddressLocationField
                  label="Find Your Church"
                  onLocationSelect={(location) => {
                    if (!location) return;

                    form.setFieldValue("name", location.name);
                    form.setFieldValue("street", location.street ?? "");
                    form.setFieldValue("city", location.city ?? "");
                    form.setFieldValue("state", location.state ?? "");
                    form.setFieldValue("zip", location.postcode ?? "");
                    form.setFieldValue("countryCode", location.countrycode ?? "");
                    form.setFieldValue("url", location.url ?? "");
                  }}
                  placeholder="Search for your church on Google Maps"
                />
              )}
            </form.AppField>

            <form.AppField name="name">
              {(field) => <field.InputField label="Church Name" required />}
            </form.AppField>

            <div className="grid gap-4 md:grid-cols-2">
              <form.AppField name="street">
                {(field) => <field.InputField label="Street" />}
              </form.AppField>
              <form.AppField name="city">
                {(field) => <field.InputField label="City" />}
              </form.AppField>
              <form.AppField name="state">
                {(field) => <field.InputField label="State / Region" />}
              </form.AppField>
              <form.AppField name="zip">
                {(field) => <field.InputField label="Postal Code" />}
              </form.AppField>
              <form.AppField name="countryCode">
                {(field) => <field.InputField label="Country Code" placeholder="US" />}
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

            <form.AppField name="url">
              {(field) => <field.InputField label="Website" placeholder="https://example.org" />}
            </form.AppField>

            <form.AppField name="size">
              {(field) => (
                <field.SelectField
                  label="Church Size"
                  options={CHURCH_SIZE_OPTIONS}
                  placeholder="Select a size"
                />
              )}
            </form.AppField>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

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
          </Form>
        </CardContent>
      </Card>
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

function detectedChurchTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}
