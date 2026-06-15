import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import { CardForm } from "@/components/form/card-form";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { authClient } from "@/lib/auth-client";
import {
  getChurchProfileSettingsDefaultValues,
  normalizeOptionalChurchProfileValue,
  normalizeProfileName,
} from "@/routes/-settings-utils";

function churchTimeZoneOptions(churchTimeZone: string | null) {
  const timeZones =
    churchTimeZone && !supportedChurchTimeZones.includes(churchTimeZone)
      ? [churchTimeZone, ...supportedChurchTimeZones]
      : supportedChurchTimeZones;

  return timeZones.map((timeZone) => ({ label: timeZone, value: timeZone }));
}

function canUpdateChurchSettings(role: string | string[]) {
  return Array.isArray(role)
    ? role.includes("owner") || role.includes("admin")
    : role === "owner" || role === "admin";
}

const ProfileSettingsSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.transform(Schema.String, {
      decode: normalizeProfileName,
      encode: (value) => value,
    }),
    Schema.minLength(1, { message: () => "Name is required." }),
  ),
});

const CHURCH_SIZE_OPTIONS = [
  { label: "Not set", value: "none" },
  { label: "Under 100 people", value: "under_100" },
  { label: "100-250 people", value: "100_250" },
  { label: "251-500 people", value: "251_500" },
  { label: "501-1,000 people", value: "501_1000" },
  { label: "More than 1,000 people", value: "over_1000" },
];

const supportedChurchTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Africa/Johannesburg",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const ChurchProfileSettingsSchema = Schema.Struct({
  churchTimeZone: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Church Time Zone is required." }),
  ),
  city: Schema.String,
  countryCode: Schema.String,
  name: Schema.String.pipe(Schema.minLength(2, { message: () => "Church name is required." })),
  size: Schema.String,
  state: Schema.String,
  street: Schema.String,
  url: Schema.String,
  zip: Schema.String,
});

export function SettingsProfilePanel() {
  const { data, refetch: refetchSession } = authClient.useSession();
  const user = data?.user;

  if (!user) {
    return <SettingsFormSkeleton />;
  }

  return <SettingsProfileForm refetchSession={refetchSession} user={user} />;
}

/**
 * Form-shaped Skeleton for settings panels while session or Active Church
 * data has not yet arrived (ADR 0010 — no "Loading X..." text).
 */
function SettingsFormSkeleton({ fields = 2 }: { readonly fields?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: fields }, (_, index) => (
        <div className="flex flex-col gap-1.5" key={index}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}

function SettingsProfileForm({
  refetchSession,
  user,
}: {
  readonly refetchSession: () => Promise<unknown>;
  readonly user: { readonly id: string; readonly name: string; readonly email: string };
}) {
  const [profileError, setProfileError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      name: user.name,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ProfileSettingsSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      const name = normalizeProfileName(value.name);
      setProfileError(null);

      const result = await authClient.updateUser({ name });
      if (result.error) {
        setProfileError(result.error.message ?? "Could not update profile.");
        return;
      }

      formApi.reset({ name });
      await refetchSession();
      toast.success("Profile updated.");
    },
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Manage your Church Task account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <CardForm
            Actions={
              <form.Subscribe
                selector={(state) => ({
                  isDefaultValue: state.isDefaultValue,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ isDefaultValue, isSubmitting }) => (
                  <Button
                    className="mr-auto"
                    disabled={isDefaultValue}
                    loading={isSubmitting}
                    type="submit"
                  >
                    Update Profile
                  </Button>
                )}
              </form.Subscribe>
            }
            actionsClassName="justify-start"
            form={form}
            Primary={
              <>
                <form.AppField name="name">
                  {(field) => (
                    <field.InputField
                      autoCapitalize="words"
                      autoComplete="name"
                      label="Name"
                      placeholder="Jane Doe"
                      required
                    />
                  )}
                </form.AppField>
                <SettingDetail label="Email" value={user.email} />
                {profileError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{profileError}</AlertDescription>
                  </Alert>
                ) : null}
              </>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical</CardTitle>
          <CardDescription>Details you may need when contacting support.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingDetail label="User Id" value={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsChurchPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const { refetch: refetchSession } = authClient.useSession();

  if (loading) {
    return <SettingsFormSkeleton fields={4} />;
  }

  if (!activeChurch) {
    return <p className="text-sm text-muted-foreground">No active Church selected.</p>;
  }

  return <SettingsChurchForm activeChurch={activeChurch} refetchSession={refetchSession} />;
}

function SettingsChurchForm({
  activeChurch,
  refetchSession,
}: {
  readonly activeChurch: CurrentOrg;
  readonly refetchSession: () => Promise<unknown>;
}) {
  const [churchError, setChurchError] = useState<string | null>(null);
  const canUpdate = canUpdateChurchSettings(activeChurch.role);

  const form = useAppForm({
    defaultValues: getChurchProfileSettingsDefaultValues(activeChurch),
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(ChurchProfileSettingsSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      setChurchError(null);

      const name = normalizeProfileName(value.name);
      const result = await authClient.organization.update({
        data: {
          churchTimeZone: value.churchTimeZone.trim(),
          city: normalizeOptionalChurchProfileValue(value.city),
          countryCode: normalizeOptionalChurchProfileValue(value.countryCode),
          name,
          size: normalizeOptionalChurchProfileValue(value.size),
          state: normalizeOptionalChurchProfileValue(value.state),
          street: normalizeOptionalChurchProfileValue(value.street),
          url: normalizeOptionalChurchProfileValue(value.url),
          zip: normalizeOptionalChurchProfileValue(value.zip),
        },
        organizationId: activeChurch.id,
      });

      if (result.error) {
        setChurchError(result.error.message ?? "Could not update Church profile.");
        return;
      }

      const nextValues = {
        churchTimeZone: value.churchTimeZone.trim(),
        city: value.city.trim(),
        countryCode: value.countryCode.trim(),
        name,
        size: value.size,
        state: value.state.trim(),
        street: value.street.trim(),
        url: value.url.trim(),
        zip: value.zip.trim(),
      };
      formApi.reset(nextValues);
      await refetchSession();
      toast.success("Church profile updated.");
    },
  });

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Church Profile</CardTitle>
          <CardDescription>
            Manage the Church details used across onboarding, invitations, and Cycle boundaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CardForm
            Actions={
              <form.Subscribe
                selector={(state) => ({
                  isDefaultValue: state.isDefaultValue,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ isDefaultValue, isSubmitting }) => (
                  <Button
                    className="mr-auto"
                    disabled={!canUpdate || isDefaultValue}
                    loading={isSubmitting}
                    type="submit"
                  >
                    Update Church Profile
                  </Button>
                )}
              </form.Subscribe>
            }
            actionsClassName="justify-start"
            form={form}
            Primary={
              <fieldset className="contents" disabled={!canUpdate}>
                <form.AppField name="name">
                  {(field) => <field.InputField label="Church Name" required />}
                </form.AppField>
                <form.AppField name="churchTimeZone">
                  {(field) => (
                    <field.SelectField
                      label="Church Time Zone"
                      options={churchTimeZoneOptions(activeChurch.churchTimeZone)}
                      required
                    />
                  )}
                </form.AppField>
                <form.AppField name="url">
                  {(field) => (
                    <field.InputField label="Website" placeholder="https://example.org" />
                  )}
                </form.AppField>
                <form.AppField name="size">
                  {(field) => (
                    <field.SelectField label="Church Size" options={CHURCH_SIZE_OPTIONS} />
                  )}
                </form.AppField>
                {!canUpdate ? (
                  <Alert>
                    <AlertDescription>
                      Only Church owners and admins can update Church settings.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {churchError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{churchError}</AlertDescription>
                  </Alert>
                ) : null}
              </fieldset>
            }
            Secondary={
              <fieldset className="contents" disabled={!canUpdate}>
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
                  {(field) => <field.InputField label="Country Code" />}
                </form.AppField>
              </fieldset>
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Technical</CardTitle>
          <CardDescription>Details you may need when contacting support.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingDetail label="Org Id" value={activeChurch.id} />
        </CardContent>
      </Card>
    </section>
  );
}

function SettingDetail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid gap-1">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="break-all">{value}</div>
    </div>
  );
}
