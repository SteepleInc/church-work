import { revalidateLogic } from "@tanstack/react-form";
import { Schema, SchemaGetter } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { UserAvatar } from "@/components/avatars/userAvatar";
import { Form } from "@/components/form/form";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import { SettingsFieldRow, SettingsSection } from "@/features/settings/settings-page";
import { useSession } from "@/hooks/use-session";
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
    Schema.decode({
      decode: SchemaGetter.transform(normalizeProfileName),
      encode: SchemaGetter.transform((value) => value),
    }),
    Schema.check(Schema.isMinLength(1, { message: "Name is required." })),
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
    Schema.check(Schema.isMinLength(1, { message: "Church Time Zone is required." })),
  ),
  city: Schema.String,
  countryCode: Schema.String,
  name: Schema.String.pipe(
    Schema.check(Schema.isMinLength(2, { message: "Church name is required." })),
  ),
  size: Schema.String,
  state: Schema.String,
  street: Schema.String,
  url: Schema.String,
  zip: Schema.String,
});

export function SettingsProfilePanel() {
  const { refetch: refetchSession, session } = useSession();
  const user = session?.user;

  if (!user) {
    return <SettingsCardSkeleton rowCounts={[2, 1]} />;
  }

  return <SettingsProfileForm refetchSession={refetchSession} user={user} />;
}

/**
 * Card-shaped Skeleton matching the Linear-style sectioned settings forms so the
 * loading state does not shift layout once session / Active Church data arrives
 * (ADR 0010 — no "Loading X..." text). Each entry in `rowCounts` renders one
 * framed card with that many field rows; cards after the first show a title
 * placeholder above them.
 */
function SettingsCardSkeleton({ rowCounts }: { readonly rowCounts: readonly number[] }) {
  return (
    <div className="flex flex-col gap-8">
      {rowCounts.map((rowCount, sectionIndex) => (
        <div className="flex flex-col gap-2.5" key={sectionIndex}>
          {sectionIndex > 0 ? <Skeleton className="h-3 w-24" /> : null}
          <div className="rounded-lg border border-border/70 bg-card px-5">
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <div
                className="flex items-center justify-between gap-6 border-border/60 border-b py-3.5 last:border-b-0"
                key={rowIndex}
              >
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-8 w-[17.5rem]" />
              </div>
            ))}
          </div>
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
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image?: string | null;
  };
}) {
  const [profileError, setProfileError] = useState<string | null>(null);

  const fieldWrapperClassName = "w-full max-w-none gap-1.5";

  const form = useAppForm({
    defaultValues: {
      name: user.name,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.toStandardSchemaV1(ProfileSettingsSchema),
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
    <Form className="flex flex-col gap-8" form={form}>
      <SettingsSection card>
        <SettingsFieldRow
          control={
            <UserAvatar className="ml-auto" avatar={user.image} name={user.name} userId={user.id} />
          }
          description="Recommended size is 256x256px"
          label="Photo"
        />
        <form.AppField name="name">
          {(field) => (
            <SettingsFieldRow
              control={
                <field.InputField
                  autoCapitalize="words"
                  autoComplete="off"
                  data-1p-ignore="true"
                  label=""
                  placeholder="Jane Doe"
                  required
                  wrapperClassName={fieldWrapperClassName}
                />
              }
              htmlFor="name"
              label="Name"
            />
          )}
        </form.AppField>
        <SettingsFieldRow
          control={<span className="truncate text-muted-foreground text-sm">{user.email}</span>}
          description="Used to sign in and for notifications"
          label="Email"
        />
      </SettingsSection>

      <SettingsSection card title="Technical">
        <SettingsFieldRow
          control={<span className="break-all text-muted-foreground text-sm">{user.id}</span>}
          description="The unique identifier for your account"
          label="User ID"
        />
      </SettingsSection>

      {profileError ? (
        <Alert variant="destructive">
          <AlertDescription>{profileError}</AlertDescription>
        </Alert>
      ) : null}

      <form.Subscribe
        selector={(state) => ({
          isDefaultValue: state.isDefaultValue,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ isDefaultValue, isSubmitting }) =>
          isDefaultValue ? null : (
            <div className="sticky bottom-0 z-10 -mx-8 flex items-center justify-end gap-3 border-border border-t bg-background/80 px-8 py-4 backdrop-blur md:-mx-12 md:px-12">
              <Button onClick={() => form.reset()} type="button" variant="ghost">
                Discard
              </Button>
              <Button loading={isSubmitting} type="submit">
                Save changes
              </Button>
            </div>
          )
        }
      </form.Subscribe>
    </Form>
  );
}

export function SettingsChurchPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const { refetch: refetchSession } = useSession();

  if (loading) {
    return <SettingsCardSkeleton rowCounts={[3, 2, 5]} />;
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
      onSubmit: Schema.toStandardSchemaV1(ChurchProfileSettingsSchema),
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

  const fieldWrapperClassName = "w-full max-w-none gap-1.5";

  return (
    <Form className="flex flex-col gap-8" form={form}>
      <fieldset className="contents" disabled={!canUpdate}>
        <SettingsSection card>
          <SettingsFieldRow
            control={
              <BaseAvatar
                _tag="org"
                avatar={null}
                className="ml-auto"
                name={activeChurch.name}
                size={40}
              />
            }
            description="Recommended size is 256x256px"
            label="Logo"
          />
          <form.AppField name="name">
            {(field) => (
              <SettingsFieldRow
                control={
                  <field.InputField
                    label=""
                    placeholder="Workspace name"
                    required
                    wrapperClassName={fieldWrapperClassName}
                  />
                }
                htmlFor="name"
                label="Name"
              />
            )}
          </form.AppField>
          <SettingsFieldRow
            control={<UrlPreview slug={activeChurch.slug} />}
            description="Where members find this workspace"
            label="URL"
          />
          <form.AppField name="url">
            {(field) => (
              <SettingsFieldRow
                control={
                  <field.InputField
                    label=""
                    placeholder="https://example.org"
                    wrapperClassName={fieldWrapperClassName}
                  />
                }
                description="Your church's public website"
                htmlFor="url"
                label="Website"
              />
            )}
          </form.AppField>
        </SettingsSection>

        <SettingsSection card title="Time & region">
          <form.AppField name="churchTimeZone">
            {(field) => (
              <SettingsFieldRow
                control={
                  <field.SelectField
                    label=""
                    options={churchTimeZoneOptions(activeChurch.churchTimeZone)}
                    required
                    wrapperClassName={fieldWrapperClassName}
                  />
                }
                description="Used for Cycle boundaries and scheduling"
                htmlFor="churchTimeZone"
                label="Time zone"
              />
            )}
          </form.AppField>
          <form.AppField name="size">
            {(field) => (
              <SettingsFieldRow
                control={
                  <field.SelectField
                    label=""
                    options={CHURCH_SIZE_OPTIONS}
                    wrapperClassName={fieldWrapperClassName}
                  />
                }
                description="Approximate weekly attendance"
                htmlFor="size"
                label="Church size"
              />
            )}
          </form.AppField>
        </SettingsSection>

        <SettingsSection card title="Address">
          <form.AppField name="street">
            {(field) => (
              <SettingsFieldRow
                control={<field.InputField label="" wrapperClassName={fieldWrapperClassName} />}
                htmlFor="street"
                label="Street"
              />
            )}
          </form.AppField>
          <form.AppField name="city">
            {(field) => (
              <SettingsFieldRow
                control={<field.InputField label="" wrapperClassName={fieldWrapperClassName} />}
                htmlFor="city"
                label="City"
              />
            )}
          </form.AppField>
          <form.AppField name="state">
            {(field) => (
              <SettingsFieldRow
                control={<field.InputField label="" wrapperClassName={fieldWrapperClassName} />}
                htmlFor="state"
                label="State / region"
              />
            )}
          </form.AppField>
          <form.AppField name="zip">
            {(field) => (
              <SettingsFieldRow
                control={<field.InputField label="" wrapperClassName={fieldWrapperClassName} />}
                htmlFor="zip"
                label="Postal code"
              />
            )}
          </form.AppField>
          <form.AppField name="countryCode">
            {(field) => (
              <SettingsFieldRow
                control={<field.InputField label="" wrapperClassName={fieldWrapperClassName} />}
                htmlFor="countryCode"
                label="Country code"
              />
            )}
          </form.AppField>
        </SettingsSection>
      </fieldset>

      <SettingsSection card title="Technical">
        <SettingsFieldRow
          control={
            <span className="break-all text-muted-foreground text-sm">{activeChurch.id}</span>
          }
          description="The unique identifier for this workspace"
          label="Workspace ID"
        />
      </SettingsSection>

      {!canUpdate ? (
        <Alert>
          <AlertDescription>
            Only Church owners and admins can update workspace settings.
          </AlertDescription>
        </Alert>
      ) : null}
      {churchError ? (
        <Alert variant="destructive">
          <AlertDescription>{churchError}</AlertDescription>
        </Alert>
      ) : null}

      {canUpdate ? (
        <form.Subscribe
          selector={(state) => ({
            isDefaultValue: state.isDefaultValue,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ isDefaultValue, isSubmitting }) =>
            isDefaultValue ? null : (
              <div className="sticky bottom-0 z-10 -mx-8 flex items-center justify-end gap-3 border-border border-t bg-background/80 px-8 py-4 backdrop-blur md:-mx-12 md:px-12">
                <Button onClick={() => form.reset()} type="button" variant="ghost">
                  Discard
                </Button>
                <Button loading={isSubmitting} type="submit">
                  Save changes
                </Button>
              </div>
            )
          }
        </form.Subscribe>
      ) : null}
    </Form>
  );
}

function UrlPreview({ slug }: { readonly slug: string | null }) {
  return (
    <div className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 text-sm">
      <span className="text-muted-foreground">app/</span>
      <span className="truncate font-medium">{slug ?? "workspace"}</span>
    </div>
  );
}
