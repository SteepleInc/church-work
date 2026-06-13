import { api } from "@church-task/backend/convex/_generated/api";
import { getLabelColorForName } from "@church-task/domain/Label";
import { useMutation } from "convex/react";
import { useConvexQuery as useQuery } from "@/data/query-hooks";

import { appendItem, removeById } from "@/data/collection-ops";
import { successfulResponseCollection } from "@/data/convex-query-adapter";
import {
  collectionItemOptimisticUpdate,
  collectionListOptimisticUpdate,
} from "@/data/optimistic-collection";

export type LabelItem = {
  readonly id: string;
  readonly churchId: string;
  readonly teamId: string | null;
  readonly name: string;
  readonly color: string;
};

function optimisticId(): string {
  return `optimistic-label-${Math.random().toString(36).slice(2)}`;
}

/**
 * Church Labels ride along on the work-defaults read (like Workflows), so the
 * picker, cards, and settings page share one cached query.
 */
export function useLabelsCollection(params: { readonly churchId: string | null }) {
  const result = useQuery(
    api.workDefaults.readForChurch,
    params.churchId ? { churchId: params.churchId } : "skip",
  );
  const state = successfulResponseCollection(
    result,
    (response) => response.data.labels as readonly LabelItem[],
  );

  return {
    loading: params.churchId !== null && state.loading,
    collection: state.collection,
    labelsCollection: state.collection,
  };
}

export function useCreateLabelMutation() {
  return useMutation(api.labels.createForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "labels",
      patch: (
        labels: readonly LabelItem[],
        args: { readonly churchId: string; readonly name: string },
      ) =>
        appendItem(labels, {
          id: optimisticId(),
          churchId: args.churchId,
          teamId: null,
          name: args.name,
          color: getLabelColorForName(args.name),
        }),
    }),
  );
}

export function useUpdateLabelMutation() {
  return useMutation(api.labels.updateForChurch).withOptimisticUpdate(
    collectionItemOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "labels",
      patch: (
        label: LabelItem,
        args: { readonly labelId: string; readonly name?: string; readonly color?: string },
      ) =>
        label.id === args.labelId
          ? {
              ...label,
              ...(args.name !== undefined ? { name: args.name } : {}),
              ...(args.color !== undefined ? { color: args.color } : {}),
            }
          : undefined,
    }),
  );
}

export function useDeleteLabelMutation() {
  return useMutation(api.labels.deleteForChurch).withOptimisticUpdate(
    collectionListOptimisticUpdate({
      query: api.workDefaults.readForChurch,
      collectionKey: "labels",
      patch: (labels: readonly LabelItem[], args: { readonly labelId: string }) =>
        removeById(labels, args.labelId),
    }),
  );
}
