import { createFileRoute } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { MainContainer, PageContainer } from "@/components/pageComponents";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDiscardAllDraftsMutation,
  useDiscardDraftMutation,
  useMyDraftsCollection,
  useRestoreDraftsMutation,
} from "@/data/drafts/draftsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { DraftCard } from "@/features/drafts/draft-card";
import { createTaskQuickActionStateAtom } from "@/features/quick-actions/create-task-quick-action";

export const Route = createFileRoute("/_org/drafts")({ component: DraftsPage });

function DraftsPage() {
  const { currentOrgOpt } = useCurrentOrgOpt();
  const churchId = currentOrgOpt?.id ?? null;

  const { collection, loading } = useMyDraftsCollection();
  const discardDraft = useDiscardDraftMutation();
  const discardAll = useDiscardAllDraftsMutation();
  const restoreDrafts = useRestoreDraftsMutation();
  const openCreateTask = useSetAtom(createTaskQuickActionStateAtom);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardingDraftIds, setDiscardingDraftIds] = useState(() => new Set<string>());

  const visibleDrafts = collection.filter((draft) => !discardingDraftIds.has(draft.draft_id));
  const count = visibleDrafts.length;

  async function onDiscardOne(draftId: string) {
    setDiscardingDraftIds((ids) => new Set(ids).add(draftId));
    const result = await discardDraft(draftId);
    if (result.type === "error") {
      setDiscardingDraftIds((ids) => {
        const next = new Set(ids);
        next.delete(draftId);
        return next;
      });
      toast.error(result.error?.message ?? "Could not discard draft.");
      return;
    }
    toast.success("Draft discarded.", {
      action: {
        label: "Undo",
        onClick: () => {
          setDiscardingDraftIds((ids) => {
            const next = new Set(ids);
            next.delete(draftId);
            return next;
          });
          void restoreDrafts([draftId]);
        },
      },
    });
  }

  async function onDiscardAll() {
    const ids = visibleDrafts.map((draft) => draft.draft_id);
    setConfirmOpen(false);
    setDiscardingDraftIds((discardingIds) => new Set([...discardingIds, ...ids]));
    const result = await discardAll(ids);
    if (result.type === "error") {
      setDiscardingDraftIds((discardingIds) => {
        const next = new Set(discardingIds);
        for (const id of ids) next.delete(id);
        return next;
      });
      toast.error(result.error?.message ?? "Could not discard drafts.");
      return;
    }
    toast.success(ids.length === 1 ? "Draft discarded." : `${ids.length} drafts discarded.`, {
      action: {
        label: "Undo",
        onClick: () => {
          setDiscardingDraftIds((discardingIds) => {
            const next = new Set(discardingIds);
            for (const id of ids) next.delete(id);
            return next;
          });
          void restoreDrafts(ids);
        },
      },
    });
  }

  function onOpenDraft(draftId: string) {
    openCreateTask({ assignTo: null, draftId });
  }

  return (
    <MainContainer>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-0 pb-3 md:pt-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-semibold text-2xl tracking-tight">Drafts</h1>
          {!loading && count > 0 ? (
            <Badge className="tabular-nums" variant="secondary">
              {count}
            </Badge>
          ) : null}
        </div>
        {!loading && count > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Discard all drafts"
                  onClick={() => setConfirmOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <Trash2Icon />
                  Discard all
                </Button>
              }
            />
            <TooltipContent>Discard every draft</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <PageContainer className="flex-1" wrapperClassName="pt-0">
        {loading ? (
          <DraftsSkeleton />
        ) : count === 0 ? (
          <Empty className="min-h-72 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>No active drafts</EmptyTitle>
              <EmptyDescription>
                Start a New Task and choose Save to drafts to keep it for later. Your saved drafts
                land here, ready to finish whenever you are.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mx-auto grid w-full max-w-3xl gap-3">
            {visibleDrafts.map((draft) => (
              <DraftCard
                churchId={churchId}
                key={draft.draft_id}
                onDiscard={onDiscardOne}
                onOpen={onOpenDraft}
                taskDraft={draft}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {count === 1 ? "Discard this draft?" : `Discard all ${count} drafts?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? "This draft leaves your Drafts. You can undo right after."
                : "Every draft leaves your Drafts. You can undo right after."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{count === 1 ? "Keep it" : "Keep them"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onDiscardAll();
              }}
              variant="destructive"
            >
              {count === 1 ? "Discard draft" : "Discard all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainContainer>
  );
}

function DraftsSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-3" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div className="rounded-xl border bg-card p-4 shadow-xs" key={row}>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2.5 h-3 w-4/5" />
          <div className="mt-4 flex gap-1.5">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
