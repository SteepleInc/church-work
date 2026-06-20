import { Array, Option, pipe } from "effect";
import { useSetAtom } from "jotai";
import { LibraryBig } from "lucide-react";

import { Collection } from "@/components/collections/collection";
import { Button } from "@/components/ui/button";
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
import { canManageTemplates } from "@/features/templates/template-soft-delete";
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

  const nameFilter = useTemplateNameFilter();
  const { limit, loading, nextPage, pageSize, templatesCollection } =
    useTemplatesCollectionWithFilters({ churchId, nameFilter });

  const startCreate = () =>
    openBigAction(TemplateBigActionState.create({ shape: "weekly_service", step: 0 }));

  const newTemplateButton = canManage ? (
    <Button onClick={startCreate} size="sm" type="button">
      <PlusIcon />
      New Template
    </Button>
  ) : undefined;

  return (
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
    />
  );
}
