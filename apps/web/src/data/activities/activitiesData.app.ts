import { api } from "@church-task/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import { successfulResponseCollection } from "@/data/convex-query-adapter";

export type ActivityEntityType =
  | "task"
  | "template"
  | "cycle"
  | "team"
  | "workflow"
  | "keyDate"
  | "church";

export type ActivityCollectionItem = {
  readonly id: string;
  readonly churchId: string;
  readonly entityType: ActivityEntityType;
  readonly entityId: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly cycleId: string | null;
  readonly metadata: unknown;
};

export function useActivitiesForEntityCollection(params: {
  readonly churchId: string | null;
  readonly entityType: ActivityEntityType;
  readonly entityId: string | null;
}) {
  const result = useQuery(
    api.activities.listForEntity,
    params.churchId && params.entityId
      ? {
          churchId: params.churchId,
          entityType: params.entityType,
          entityId: params.entityId,
        }
      : "skip",
  );
  const state = successfulResponseCollection(result, (response) => response.data.activities);

  return {
    loading: params.churchId !== null && params.entityId !== null && state.loading,
    collection: state.collection as readonly ActivityCollectionItem[],
    activitiesCollection: state.collection as readonly ActivityCollectionItem[],
  };
}
