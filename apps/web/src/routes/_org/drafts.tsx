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
  const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null);
  const [discardingDraftIds, setDiscardingDraftIds] = useState(() => new Set<string>());

  const visibleDrafts = collection.filter((draft) => !discardingDraftIds.has(draft.draft_id));
  const count = visibleDrafts.length;

  async function onDiscardOne(draftId: string) {
    if (!churchId) return;
    setDiscardingDraftIds((ids) => new Set(ids).add(draftId));
    const result = await discardDraft(churchId, draftId);
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
          void restoreDrafts(churchId, [draftId]);
        },
      },
    });
  }

  async function onDiscardAll() {
    if (!churchId) return;
    const ids = visibleDrafts.map((draft) => draft.draft_id);
    setConfirmOpen(false);
    setDiscardingDraftIds((discardingIds) => new Set([...discardingIds, ...ids]));
    const result = await discardAll(churchId, ids);
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
          void restoreDrafts(churchId, ids);
        },
      },
    });
  }

  function onOpenDraft(draftId: string) {
    openCreateTask({ assignTo: null, draftId });
  }

  return (
    <MainContainer>
      {/* Linear keeps the page title in the top breadcrumb bar rather than a
          separate in-page header. The shell already renders the "Drafts" crumb;
          here we only surface the discard-all affordance, right-aligned in a
          thin header row, matching Linear's Drafts panel. */}
      <div className="flex h-9 shrink-0 items-center justify-end px-4">
        {!loading && count > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Discard all drafts"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              }
            />
            <TooltipContent>Discard all drafts</TooltipContent>
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
          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-muted-foreground text-sm">Issues</h2>
            {/* A responsive column grid: each column caps at 540px, and the
                grid packs as many 540px columns as fit, Linear-style. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(0,540px))] gap-3">
              {visibleDrafts.map((draft) => (
                <DraftCard
                  churchId={churchId}
                  key={draft.draft_id}
                  onDiscard={setPendingDiscardId}
                  onOpen={onOpenDraft}
                  taskDraft={draft}
                />
              ))}
            </div>
          </section>
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

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDiscardId(null);
        }}
        open={pendingDiscardId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>Your draft will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                const draftId = pendingDiscardId;
                setPendingDiscardId(null);
                if (draftId) void onDiscardOne(draftId);
              }}
              variant="destructive"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainContainer>
  );
}

function DraftsSkeleton() {
  return (
    <section className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-12" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(0,540px))] gap-3">
        {[0, 1, 2].map((row) => (
          <div className="rounded-xl border bg-card p-4 shadow-xs" key={row}>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="mt-2.5 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </section>
  );
}
