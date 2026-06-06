import { useAtom } from "jotai";
import { LayoutGrid, List } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import type { CollectionTags } from "@/components/collections/collectionComponents";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { collectionViewsAtom, getCollectionView, setCollectionView } from "@/shared/global-state";

type CollectionViewToggleGroupProps = Omit<
  ComponentPropsWithoutRef<typeof ToggleGroup>,
  "value" | "onValueChange" | "defaultValue"
> & {
  readonly _tag: CollectionTags;
};

export function CollectionViewToggleGroup({ _tag, ...domProps }: CollectionViewToggleGroupProps) {
  const [collectionViews, setCollectionViews] = useAtom(collectionViewsAtom);
  const collectionView = getCollectionView(collectionViews, _tag);

  return (
    <ToggleGroup
      onValueChange={(value) => {
        const nextView = Array.isArray(value) ? value[0] : value;

        if (nextView === "table" || nextView === "cards") {
          setCollectionViews((currentViews) => setCollectionView(currentViews, _tag, nextView));
        }
      }}
      value={[collectionView]}
      {...domProps}
    >
      <ToggleGroupItem aria-label="Card view" value="cards">
        <LayoutGrid className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Table view" value="table">
        <List className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
