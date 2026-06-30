import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarIcon,
  CircleDotIcon,
  TagIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDiscardAllDraftsMutation,
  useDiscardDraftMutation,
  useMyDraftsCollection,
  useRestoreDraftsMutation,
  useTaskDraft,
} from "@/data/drafts/draftsData.app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_org/drafts")({ component: DraftsPage });

const DESCRIPTION_PLACEHOLDER = "Add a description…";

function DraftsPage() {
  const { collection } = useMyDraftsCollection();
  const discardAll = useDiscardAllDraftsMutation();
  const restoreDrafts = useRestoreDraftsMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function onDiscardAll() {
    const ids = collection.map((draft) => draft.id);
    await discardAll();
    setConfirmOpen(false);
    toast.success("Drafts discarded.", {
      action: { label: "Undo", onClick: () => void restoreDrafts(ids) },
    });
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-8">
      <div className="flex h-12 items-center justify-end">
        <Button
          aria-label="Discard all drafts"
          className={cn(collection.length === 0 && "invisible")}
          onClick={() => setConfirmOpen(true)}
          size="icon-sm"
          variant="ghost"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>

      {collection.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <h1 className="text-sm font-medium">No active drafts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Saved drafts will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-3xl gap-3">
          {collection.map((draft) => (
            <DraftCard key={draft.id} draftId={draft.id} />
          ))}
        </div>
      )}

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard all drafts?</AlertDialogTitle>
            <AlertDialogDescription>All your drafts will be discarded.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDiscardAll} variant="destructive">
              Discard all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function DraftCard({ draftId }: { readonly draftId: string }) {
  const taskDraft = useTaskDraft(draftId);
  const discardDraft = useDiscardDraftMutation();
  const restoreDrafts = useRestoreDraftsMutation();
  if (!taskDraft) return null;

  const title = taskDraft.title?.trim() || "Untitled";
  const description = taskDraft.description?.trim() || DESCRIPTION_PLACEHOLDER;
  const pills = buildPills(taskDraft);

  async function onDiscard(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    await discardDraft(draftId);
    toast.success("Draft discarded.", {
      action: { label: "Undo", onClick: () => void restoreDrafts([draftId]) },
    });
  }

  return (
    <article className="group relative rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent/30">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Discard draft"
              className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={onDiscard}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <Trash2Icon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Discard draft</TooltipContent>
      </Tooltip>

      <h2 className="pr-8 text-sm font-medium text-card-foreground">{title}</h2>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{description}</p>
      {pills.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pills.map((pill) => (
            <span
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground"
              key={pill.label}
            >
              {pill.icon}
              {pill.label}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function buildPills(taskDraft: NonNullable<ReturnType<typeof useTaskDraft>>) {
  const labels = parseLabels(taskDraft.label_ids);
  return [
    taskDraft.team_id ? { icon: <UsersIcon className="size-3" />, label: "Team" } : null,
    taskDraft.workflow_status_id
      ? { icon: <CircleDotIcon className="size-3" />, label: "Status" }
      : null,
    taskDraft.assigned_user_id
      ? { icon: <UserIcon className="size-3" />, label: "Assignee" }
      : null,
    taskDraft.priority
      ? { icon: <CircleDotIcon className="size-3" />, label: `Priority ${taskDraft.priority}` }
      : null,
    taskDraft.estimate
      ? { icon: <CircleDotIcon className="size-3" />, label: `Estimate ${taskDraft.estimate}` }
      : null,
    taskDraft.due_date
      ? { icon: <CalendarIcon className="size-3" />, label: taskDraft.due_date }
      : null,
    taskDraft.parent_task_id
      ? { icon: <CircleDotIcon className="size-3" />, label: "Parent" }
      : null,
    ...labels.map((label) => ({ icon: <TagIcon className="size-3" />, label: `Label ${label}` })),
  ].filter(Boolean) as Array<{ icon: ReactNode; label: string }>;
}

function parseLabels(raw: string | null | undefined) {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}
