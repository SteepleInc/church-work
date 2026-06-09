import { describe, expect, test } from "bun:test";

const collectionSource = await Bun.file(new URL("./collection.tsx", import.meta.url)).text();
const rowActionsSource = await Bun.file(new URL("./rowActions.tsx", import.meta.url)).text();
const cardSource = await Bun.file(new URL("./defaultCollectionCard.tsx", import.meta.url)).text();

describe("collection row actions", () => {
  test("auto-adds and pins an actions column when row actions are supplied", () => {
    expect(collectionSource).toContain("readonly rowActions?: RowActionsRenderer<TItem>");
    expect(collectionSource).toContain("createRowActionsColumn(rowActions)");
    expect(collectionSource).toContain(
      'right: Array.from(new Set([...(columnPinning?.right ?? []), "actions"]))',
    );
    expect(rowActionsSource).toContain('id: "actions"');
    expect(rowActionsSource).toContain("rowActions(row.original)");
  });

  test("keeps action cells in the card header instead of details content", () => {
    expect(cardSource).toContain('cell.column.id === "edit" || cell.column.id === "actions"');
  });
});
