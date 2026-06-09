import { nullOp } from "@church-task/shared/noOps";
import type { Table } from "@tanstack/react-table";
import { Boolean, Option, pipe } from "effect";
import type { ReactNode } from "react";

import type { CollectionTags } from "@/components/collections/collectionComponents";
import { CollectionSearchFilter } from "@/components/collections/collectionSearchFilter";
import { CollectionViewToggleGroup } from "@/components/collections/collectionViewToggleGroup";
import { Toolbar, ToolbarSeparator } from "@/components/ui/toolbar";
import { cn } from "@/lib/utils";
import type { FilterKeys } from "@/shared/global-state";
import { useIsMdScreen } from "@/shared/hooks/use-media-query";

type CollectionToolbarProps<TData> = {
  data: ReadonlyArray<TData>;
  table: Table<TData>;
  filterPlaceHolder: string;
  filterColumnId: string;
  Actions?: ReactNode;
  className?: string;
  _tag: CollectionTags;
  filterKey: FilterKeys;
};

export const CollectionToolbar = <TData,>(props: CollectionToolbarProps<TData>): ReactNode => {
  // eslint-disable-next-line react-compiler/react-compiler
  "use no memo";

  const { filterPlaceHolder, filterColumnId, Actions, className, _tag, filterKey } = props;

  const isMdScreen = useIsMdScreen();

  return (
    <div className={cn("flex w-auto flex-col gap-2 px-4 md:ml-4 md:px-0", className)}>
      {/* Main toolbar row */}
      <Toolbar className="flex min-h-10 w-auto items-center gap-2">
        <CollectionSearchFilter
          filterColumnId={filterColumnId}
          filterKey={filterKey}
          filterPlaceHolder={filterPlaceHolder}
        />

        <div className="ml-auto flex flex-row">
          <ToolbarSeparator className="-ml-1 block md:ml-0 md:hidden" />

          {/* Hide view toggle on small screens (forced to cards view) */}
          {pipe(
            isMdScreen,
            Boolean.match({
              onFalse: nullOp,
              onTrue: () => <CollectionViewToggleGroup _tag={_tag} />,
            }),
          )}

          {pipe(
            Actions,
            Option.fromNullable,
            Option.match({
              onNone: nullOp,
              onSome: (x) => <div className="ml-2 flex flex-row items-center gap-2">{x}</div>,
            }),
          )}
        </div>
      </Toolbar>
    </div>
  );
};
