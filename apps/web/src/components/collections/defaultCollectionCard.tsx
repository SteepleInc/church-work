import { flexRender, type Row } from "@tanstack/react-table";
import { Fragment } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DefaultCollectionCardProps<TData> = {
  readonly row: Row<TData>;
};

export function DefaultCollectionCard<TData>({ row }: DefaultCollectionCardProps<TData>) {
  const cells = row.getVisibleCells();
  const [primaryCell, ...detailCells] = cells;
  const actionCells = detailCells.filter(
    (cell) => cell.column.id === "edit" || cell.column.id === "actions",
  );
  const contentCells = detailCells.filter(
    (cell) => cell.column.id !== "edit" && cell.column.id !== "actions",
  );

  return (
    <Card
      className="group relative flex-1 gap-0 transition-transform"
      data-state={row.getIsSelected() && "selected"}
    >
      {primaryCell ? (
        <CardHeader className="border-b">
          <CardTitle className="row-span-2 self-center">
            {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
          </CardTitle>
          {actionCells.length > 0 ? (
            <CardAction>
              {actionCells.map((cell) => (
                <Fragment key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Fragment>
              ))}
            </CardAction>
          ) : null}
        </CardHeader>
      ) : null}

      {contentCells.length > 0 ? (
        <CardContent className="flex flex-col gap-3 py-4">
          {contentCells.map((cell) => (
            <div className="flex flex-col gap-0.5" key={cell.id}>
              <div className="-ml-1 text-muted-foreground text-xs">
                {getCardColumnLabel(cell.column.columnDef.header, cell.column.id)}
              </div>
              <div className="text-sm">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}

function getCardColumnLabel(header: unknown, fallback: string) {
  return typeof header === "string" ? header : fallback;
}
