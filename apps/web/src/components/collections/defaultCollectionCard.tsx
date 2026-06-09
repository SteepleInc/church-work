import { nullOp } from "@church-task/shared/noOps";
import type { Row } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { Array, Option, pipe } from "effect";
import { type ComponentRef, Fragment, type ReactElement, type RefObject } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DefaultCollectionCardProps<TData> = {
  row: Row<TData>;
  ref?: RefObject<ComponentRef<typeof Card>>;
};

export const DefaultCollectionCard = <TData,>(
  props: DefaultCollectionCardProps<TData>,
): ReactElement => {
  const { row, ref } = props;

  const cells = row.getVisibleCells();

  return (
    <Card
      className="group relative flex-1 gap-0 transition-transform"
      data-state={row.getIsSelected() && "selected"}
      ref={ref}
    >
      {pipe(
        cells,
        Array.head,
        Option.match({
          onNone: nullOp,
          onSome: (x) => (
            <CardHeader className="border-b">
              <CardTitle className="row-span-2 self-center">
                {flexRender(x.column.columnDef.cell, x.getContext())}
              </CardTitle>

              {pipe(
                cells,
                Array.tail,
                Option.getOrElse((): typeof cells => []),
                Array.filter((y) => y.column.id === "edit" || y.column.id === "actions"),
                Array.match({
                  onEmpty: nullOp,
                  onNonEmpty: (y) => (
                    <CardAction>
                      {pipe(
                        y,
                        Array.map((z) => (
                          <Fragment key={z.id}>
                            {flexRender(z.column.columnDef.cell, z.getContext())}
                          </Fragment>
                        )),
                      )}
                    </CardAction>
                  ),
                }),
              )}
            </CardHeader>
          ),
        }),
      )}

      {pipe(
        cells,
        Array.tail,
        Option.getOrElse((): typeof cells => []),
        Array.filter((x) => x.column.id !== "edit" && x.column.id !== "actions"),
        Array.match({
          onEmpty: nullOp,
          onNonEmpty: (x) => (
            <CardContent className="flex flex-col gap-3 py-4">
              {pipe(
                x,
                Array.match({
                  onEmpty: nullOp,
                  onNonEmpty: (y) =>
                    pipe(
                      y,
                      Array.map((z) => (
                        <div className="flex flex-col gap-0.5" key={z.id}>
                          <div className="-ml-1 text-muted-foreground text-xs">
                            {flexRender(
                              z.column.columnDef.header,
                              // @ts-expect-error header context differs from cell context
                              z.getContext(),
                            )}
                          </div>
                          <div className="text-sm">
                            {flexRender(z.column.columnDef.cell, z.getContext())}
                          </div>
                        </div>
                      )),
                    ),
                }),
              )}
            </CardContent>
          ),
        }),
      )}
    </Card>
  );
};
