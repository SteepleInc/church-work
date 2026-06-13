import { isLabelColor, LABEL_COLORS } from "@church-task/domain/Label";
import { useState } from "react";

import { labelDotClassName } from "@/components/tasks/task-card-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateLabelMutation,
  useDeleteLabelMutation,
  useLabelsCollection,
  useUpdateLabelMutation,
  type LabelItem,
} from "@/data/labels/labelsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { cn } from "@/lib/utils";

const LABEL_COLOR_OPTIONS = LABEL_COLORS.map((color) => ({
  value: color,
  label: color.charAt(0).toUpperCase() + color.slice(1),
}));

export function SettingsLabelsPanel() {
  const { currentOrgOpt: activeChurch, loading } = useCurrentOrgOpt();
  const labels = useLabelsCollection({ churchId: activeChurch?.id ?? null });

  if (loading || (activeChurch && labels.loading)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!activeChurch) {
    return <p className="text-sm text-muted-foreground">No active Church selected.</p>;
  }

  return <LabelSettingsCard churchId={activeChurch.id} labels={labels.labelsCollection} />;
}

/**
 * Label management card (mirrors the Teams settings card): an inline create
 * form, then a table of rows with inline rename, a color select, and delete.
 * Labels are open to every Church member — deliberately not role-gated
 * (see CONTEXT.md "Label").
 */
function LabelSettingsCard({
  churchId,
  labels,
}: {
  readonly churchId: string;
  readonly labels: readonly LabelItem[];
}) {
  const createLabel = useCreateLabelMutation();
  const updateLabel = useUpdateLabelMutation();
  const deleteLabel = useDeleteLabelMutation();
  const [newLabelName, setNewLabelName] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const runLabelMutation = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    onSuccess: () => void,
  ) => {
    setError(null);
    setSuccess(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Labels.");
      return;
    }

    onSuccess();
  };

  return (
    <Card aria-labelledby="labels-settings-title" role="region">
      <CardHeader>
        <CardTitle id="labels-settings-title">Labels</CardTitle>
        <CardDescription>
          Labels categorize Tasks across the Church. Every member can create and manage them.
          Deleting a Label removes it from every Task.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{labels.length} Labels</p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newLabelName.trim();
            if (!name) return;
            void runLabelMutation(
              "create",
              () => createLabel({ churchId, name }),
              () => {
                setNewLabelName("");
                setSuccess(`Created Label ${name}.`);
              },
            );
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="new-label-name">New Label Name</Label>
            <Input
              disabled={pendingAction === "create"}
              id="new-label-name"
              onChange={(event) => setNewLabelName(event.currentTarget.value)}
              value={newLabelName}
            />
          </div>
          <Button disabled={pendingAction === "create" || !newLabelName.trim()} type="submit">
            {pendingAction === "create" ? "Creating..." : "Create Label"}
          </Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.map((label) => {
              const draftName = renameDrafts[label.id] ?? label.name;

              return (
                <TableRow key={label.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("size-2.5 shrink-0 rounded-full", labelDotClassName(label))}
                      />
                      <Label className="sr-only" htmlFor={`rename-label-${label.id}`}>
                        Rename {label.name}
                      </Label>
                      <Input
                        disabled={pendingAction === `rename-${label.id}`}
                        id={`rename-label-${label.id}`}
                        onChange={(event) =>
                          setRenameDrafts((drafts) => ({
                            ...drafts,
                            [label.id]: event.currentTarget.value,
                          }))
                        }
                        value={draftName}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Label className="sr-only" htmlFor={`recolor-label-${label.id}`}>
                      Change color of {label.name}
                    </Label>
                    <NativeSelect
                      disabled={pendingAction === `recolor-${label.id}`}
                      id={`recolor-label-${label.id}`}
                      onChange={(event) => {
                        const color = event.currentTarget.value;
                        if (!isLabelColor(color)) return;
                        void runLabelMutation(
                          `recolor-${label.id}`,
                          () => updateLabel({ churchId, labelId: label.id, color }),
                          () => setSuccess(`Changed color of ${label.name}.`),
                        );
                      }}
                      value={label.color}
                    >
                      {LABEL_COLOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        disabled={
                          pendingAction === `rename-${label.id}` ||
                          !draftName.trim() ||
                          draftName.trim() === label.name
                        }
                        onClick={() => {
                          const name = draftName.trim();
                          void runLabelMutation(
                            `rename-${label.id}`,
                            () => updateLabel({ churchId, labelId: label.id, name }),
                            () => setSuccess(`Renamed Label to ${name}.`),
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Rename Label {label.name}
                      </Button>
                      <Button
                        disabled={pendingAction === `delete-${label.id}`}
                        onClick={() =>
                          void runLabelMutation(
                            `delete-${label.id}`,
                            () => deleteLabel({ churchId, labelId: label.id }),
                            () => setSuccess(`Deleted Label ${label.name}.`),
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Delete Label {label.name}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
