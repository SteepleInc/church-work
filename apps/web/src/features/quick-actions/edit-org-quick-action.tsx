import { api } from "@church-task/backend/convex/_generated/api";
import { revalidateLogic } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { Schema } from "effect";
import { Building2Icon, PencilIcon } from "lucide-react";
import { atom, useAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";
import {
  QuickActionForm,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

type EditOrgQuickActionState = {
  readonly orgId: string;
};

export const editOrgQuickActionStateAtom = atom<EditOrgQuickActionState | null>(null);

const supportedChurchTimeZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function detectedChurchTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
}

function churchTimeZoneOptions(churchTimeZone: string | null | undefined) {
  const timeZones =
    churchTimeZone && !supportedChurchTimeZones.includes(churchTimeZone)
      ? [churchTimeZone, ...supportedChurchTimeZones]
      : supportedChurchTimeZones;

  return timeZones.map((timeZone) => ({ label: timeZone, value: timeZone }));
}

function normalizeOptionalOrgValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? null : trimmedValue;
}

function getEditOrgDefaultValues(org: OrgCollectionItem) {
  return {
    name: org.name,
    slug: org.slug ?? "",
    churchTimeZone: org.churchTimeZone ?? detectedChurchTimeZone(),
    street: org.street ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    zip: org.zip ?? "",
    countryCode: org.countryCode ?? "",
    size: org.size ?? "",
    url: org.url ?? "",
    completedOnboarding: org.completedOnboarding,
  };
}

const EditOrgSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Name is required." })),
  slug: Schema.String,
  churchTimeZone: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Church Time Zone is required." }),
  ),
  street: Schema.String,
  city: Schema.String,
  state: Schema.String,
  zip: Schema.String,
  countryCode: Schema.String,
  size: Schema.String,
  url: Schema.String,
  completedOnboarding: Schema.Boolean,
});

export function EditOrgQuickAction() {
  const [editOrgState, setEditOrgState] = useAtom(editOrgQuickActionStateAtom);
  const org = useQuery(api.admin.getOrg, editOrgState ? { orgId: editOrgState.orgId } : "skip");
  const isOpen = editOrgState !== null;

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && setEditOrgState(null)}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <Building2Icon className="mr-2 size-4" />
            Edit org
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          Update Church profile, address, size, website, and onboarding fields.
        </QuickActionsDescription>
      </QuickActionsHeader>
      {org === undefined ? (
        <p className="px-4 pb-4 text-muted-foreground text-sm">Loading Church...</p>
      ) : org === null ? (
        <Alert className="m-4 mt-0">
          <AlertDescription>Church details are unavailable.</AlertDescription>
        </Alert>
      ) : (
        <EditOrgForm
          key={org.id}
          org={org}
          onUpdated={() => {
            setEditOrgState(null);
            toast.success("Church updated.");
          }}
        />
      )}
    </QuickActionsWrapper>
  );
}

function EditOrgForm({
  org,
  onUpdated,
}: {
  readonly org: OrgCollectionItem;
  readonly onUpdated: () => void;
}) {
  const updateOrg = useMutation(api.admin.updateOrg);
  const [editError, setEditError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: getEditOrgDefaultValues(org),
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(EditOrgSchema),
    },
    onSubmit: async ({ value }) => {
      setEditError(null);

      try {
        await updateOrg({
          orgId: org.id,
          name: value.name.trim(),
          slug: normalizeOptionalOrgValue(value.slug),
          churchTimeZone: value.churchTimeZone,
          street: normalizeOptionalOrgValue(value.street),
          city: normalizeOptionalOrgValue(value.city),
          state: normalizeOptionalOrgValue(value.state),
          zip: normalizeOptionalOrgValue(value.zip),
          countryCode: normalizeOptionalOrgValue(value.countryCode),
          size: normalizeOptionalOrgValue(value.size),
          url: normalizeOptionalOrgValue(value.url),
          completedOnboarding: value.completedOnboarding,
        });
        onUpdated();
      } catch (error) {
        setEditError(error instanceof Error ? error.message : "Could not update Church.");
      }
    },
  });

  return (
    <QuickActionForm
      form={form}
      Primary={
        <>
          <form.AppField name="name">
            {(field) => <field.InputField label="Church Name" required />}
          </form.AppField>
          <form.AppField name="slug">{(field) => <field.InputField label="Slug" />}</form.AppField>
          <form.AppField name="churchTimeZone">
            {(field) => (
              <field.SelectField
                label="Church Time Zone"
                options={churchTimeZoneOptions(org.churchTimeZone)}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="url">
            {(field) => <field.InputField label="Website" placeholder="https://example.org" />}
          </form.AppField>
          <form.AppField name="size">
            {(field) => <field.InputField label="Church Size" />}
          </form.AppField>
          <form.AppField name="completedOnboarding">
            {(field) => <field.SwitchField label="Onboarding complete" />}
          </form.AppField>
          {editError ? (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      Secondary={
        <>
          <form.AppField name="street">
            {(field) => <field.InputField label="Street" />}
          </form.AppField>
          <form.AppField name="city">{(field) => <field.InputField label="City" />}</form.AppField>
          <form.AppField name="state">
            {(field) => <field.InputField label="State / Region" />}
          </form.AppField>
          <form.AppField name="zip">
            {(field) => <field.InputField label="Postal Code" />}
          </form.AppField>
          <form.AppField name="countryCode">
            {(field) => <field.InputField label="Country Code" />}
          </form.AppField>
        </>
      }
      Actions={
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button className="ml-auto" disabled={!canSubmit} loading={isSubmitting} type="submit">
              <PencilIcon className="size-4" />
              Save org
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
