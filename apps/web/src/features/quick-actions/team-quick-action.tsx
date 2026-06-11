import { revalidateLogic } from "@tanstack/react-form";
import { Schema } from "effect";
import { atom, useAtom } from "jotai";
import { PencilIcon, PlusIcon, UsersRoundIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  useCreateTeamMutation,
  useRenameTeamMutation,
  useTeamsCollection,
  type TeamCollectionItem,
} from "@/data/teams/teamsData.app";
import {
  QuickActionForm,
  QuickActionsDescription,
  QuickActionsHeader,
  QuickActionsTitle,
  QuickActionsWrapper,
} from "@/features/quick-actions/quick-actions-components";

export type TeamQuickActionState =
  | { readonly mode: "create"; readonly churchId: string }
  | { readonly mode: "edit"; readonly churchId: string; readonly teamId: string };

export const teamQuickActionStateAtom = atom<TeamQuickActionState | null>(null);

const TeamFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1, { message: () => "Team name is required." })),
});

export function TeamQuickAction() {
  const [state, setState] = useAtom(teamQuickActionStateAtom);
  const isOpen = state !== null;
  const isEdit = state?.mode === "edit";

  return (
    <QuickActionsWrapper open={isOpen} onOpenChange={(open) => !open && setState(null)}>
      <QuickActionsHeader className="p-4">
        <QuickActionsTitle>
          <span className="inline-flex flex-row items-center">
            <UsersRoundIcon className="mr-2 size-4" />
            {isEdit ? "Edit Team" : "Create Team"}
          </span>
        </QuickActionsTitle>
        <QuickActionsDescription>
          {isEdit ? "Update this Team's name." : "Create a Team to organize your Church's work."}
        </QuickActionsDescription>
      </QuickActionsHeader>
      {state ? <TeamQuickActionBody state={state} onDone={() => setState(null)} /> : null}
    </QuickActionsWrapper>
  );
}

function TeamQuickActionBody(props: {
  readonly state: TeamQuickActionState;
  readonly onDone: () => void;
}) {
  const { state, onDone } = props;
  const { teamsCollection, loading } = useTeamsCollection({ churchId: state.churchId });

  if (state.mode === "create") {
    return <TeamForm churchId={state.churchId} team={null} onDone={onDone} />;
  }

  const team = teamsCollection.find((candidate) => candidate.id === state.teamId) ?? null;

  if (loading) {
    return <p className="px-4 pb-4 text-muted-foreground text-sm">Loading Team...</p>;
  }

  if (!team) {
    return (
      <Alert className="m-4 mt-0">
        <AlertDescription>Team details are unavailable.</AlertDescription>
      </Alert>
    );
  }

  return <TeamForm churchId={state.churchId} key={team.id} team={team} onDone={onDone} />;
}

function TeamForm(props: {
  readonly churchId: string;
  readonly team: TeamCollectionItem | null;
  readonly onDone: () => void;
}) {
  const { churchId, team, onDone } = props;
  const createTeam = useCreateTeamMutation();
  const renameTeam = useRenameTeamMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = team !== null;

  const form = useAppForm({
    defaultValues: { name: team?.name ?? "" },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onSubmit: Schema.standardSchemaV1(TeamFormSchema),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const name = value.name.trim();

      const result = isEdit
        ? await renameTeam({ churchId, name, teamId: team.id })
        : await createTeam({ churchId, name });

      if ("error" in result) {
        setFormError(result.error.message);
        return;
      }

      toast.success(isEdit ? "Team updated." : "Team created.");
      onDone();
    },
  });

  return (
    <QuickActionForm
      form={form}
      Primary={
        <>
          <form.AppField name="name">
            {(field) => <field.InputField label="Team Name" required />}
          </form.AppField>
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
      Actions={
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button className="ml-auto" disabled={!canSubmit} loading={isSubmitting} type="submit">
              {isEdit ? <PencilIcon className="size-4" /> : <PlusIcon className="size-4" />}
              {isEdit ? "Save Team" : "Create Team"}
              <Kbd>enter</Kbd>
            </Button>
          )}
        </form.Subscribe>
      }
    />
  );
}
