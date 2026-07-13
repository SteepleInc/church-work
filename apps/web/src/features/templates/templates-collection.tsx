import { useNavigate } from "@tanstack/react-router";
import { Array, Option, pipe } from "effect";
import { useSetAtom } from "jotai";
import { LibraryBig, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Collection } from "@/components/collections/collection";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PlusIcon } from "@/components/icons/plusIcon";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { templatesColumnsDef } from "@/data/templates/templatesCollectionDef";
import {
  type TemplateCollectionItem,
  useTemplatesCollectionWithFilters,
} from "@/data/templates/templatesData.app";
import {
  TemplateBigActionState,
  templateBigActionStateAtom,
} from "@/features/big-actions/big-action-state";
import {
  canManageTemplates,
  DeleteTemplateDialog,
  useTemplateSoftDelete,
} from "@/features/templates/template-soft-delete";
import { FilterKeys } from "@/shared/global-state";
import { useFiltersValue } from "@/shared/hooks/useFilters";

/** Reads the name search value the toolbar writes to the URL for templates. */
function useTemplateNameFilter(): string {
  const filters = useFiltersValue(FilterKeys.Templates);

  return pipe(
    filters,
    Array.findFirst((filter) => filter.columnId === "name"),
    Option.flatMap((filter) => pipe(filter.values as ReadonlyArray<string>, Array.head)),
    Option.getOrElse(() => ""),
  );
}

export function TemplatesCollection() {
  const { currentOrgOpt: activeChurch } = useCurrentOrgOpt();
  const churchId = activeChurch?.id ?? null;
  const canManage = activeChurch ? canManageTemplates(activeChurch.role) : false;
  const openBigAction = useSetAtom(templateBigActionStateAtom);
  const navigate = useNavigate();
  const { removeTemplate } = useTemplateSoftDelete();
  const [pendingTemplate, setPendingTemplate] = useState<TemplateCollectionItem | null>(null);

  const nameFilter = useTemplateNameFilter();
  const { limit, loading, nextPage, pageSize, templatesCollection } =
    useTemplatesCollectionWithFilters({ churchId, nameFilter });

  const startCreate = () =>
    openBigAction(TemplateBigActionState.create({ shape: "weekly_service", step: 0 }));

  const confirmDeleteTemplate = () => {
    if (!churchId || !pendingTemplate) {
      return Promise.resolve({ error: { message: "Select a Template to delete." }, ok: false });
    }
    return removeTemplate({ id: pendingTemplate.id, name: pendingTemplate.name });
  };

  const newTemplateButton = canManage ? (
    <Button onClick={startCreate} size="sm" type="button">
      <PlusIcon />
      New Template
    </Button>
  ) : undefined;

  return (
    <>
      <Collection<TemplateCollectionItem>
        _tag="templates"
        Actions={newTemplateButton}
        columnPinning={{ left: ["name"] }}
        columnsDef={templatesColumnsDef}
        data={templatesCollection}
        emptyState={
          <Empty className="min-h-64 rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryBig />
              </EmptyMedia>
              <EmptyTitle>No Templates yet</EmptyTitle>
              <EmptyDescription>
                Create a reusable Template to project recurring Church work into upcoming Weeks.
              </EmptyDescription>
            </EmptyHeader>
            {canManage ? (
              <EmptyContent>
                <Button onClick={startCreate} type="button">
                  <PlusIcon />
                  Create a Template
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        }
        filterColumnId="name"
        filterKey={FilterKeys.Templates}
        filterPlaceHolder="Search Templates"
        limit={limit}
        loading={loading}
        nextPage={nextPage}
        pageSize={pageSize}
        rowActions={
          canManage
            ? (template) => (
                <TemplateRowActions
                  onDelete={() => setPendingTemplate(template)}
                  onEdit={() =>
                    void navigate({
                      params: { templateId: template.id },
                      to: "/templates/$templateId",
                    })
                  }
                />
              )
            : undefined
        }
      />

      <DeleteTemplateDialog
        onConfirm={confirmDeleteTemplate}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
        open={pendingTemplate !== null}
        scheduleCount={pendingTemplate?.scheduleCount ?? 0}
        templateName={pendingTemplate?.name ?? ""}
      />
    </>
  );
}

/** The trailing per-row "..." actions menu for a Template. */
function TemplateRowActions({
  onEdit,
  onDelete,
}: {
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open Template actions"
            className="opacity-0 group-hover/row:opacity-100 aria-expanded:opacity-100"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" side="bottom">
        <DropdownMenuItem className="whitespace-nowrap" onClick={onEdit}>
          <Pencil />
          Edit Template
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 />
          Delete Template
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
