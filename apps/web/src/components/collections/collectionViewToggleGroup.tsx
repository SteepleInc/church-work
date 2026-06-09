"use client";

import { useAtom } from "jotai";
import type { ComponentPropsWithoutRef, FC } from "react";

import type { CollectionTags } from "@/components/collections/collectionComponents";
import { ViewCardIcon } from "@/components/icons/viewCardIcon";
import { ViewListIcon } from "@/components/icons/viewListIcon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { collectionViewsAtom, getCollectionView, setCollectionView } from "@/shared/global-state";

type CollectionViewToggleGroupProps = Omit<
  ComponentPropsWithoutRef<typeof ToggleGroup>,
  "value" | "onValueChange" | "defaultValue" | "type"
> & {
  _tag: CollectionTags;
};

export const CollectionViewToggleGroup: FC<CollectionViewToggleGroupProps> = (props) => {
  const { _tag, ...domProps } = props;

  const [collectionViews, setCollectionViews] = useAtom(collectionViewsAtom);
  const collectionView = getCollectionView(collectionViews, _tag);

  return (
    <ToggleGroup
      onValueChange={(groupValue) => {
        const next = groupValue[0];

        if (next === "table" || next === "cards") {
          setCollectionViews((currentViews) => setCollectionView(currentViews, _tag, next));
        }
      }}
      value={[collectionView]}
      {...domProps}
    >
      <ToggleGroupItem aria-label="Card View" value="cards">
        <ViewCardIcon className="size-4" />
      </ToggleGroupItem>

      <ToggleGroupItem aria-label="Table View" value="table">
        <ViewListIcon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
