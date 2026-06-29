import { parseTaskIdentifier } from "@church-work/domain";
import { queries } from "@church-work/zero";
import { useQuery } from "@rocicorp/zero/react";

import { recordFromQueryResult } from "@/data/collection-query-state";
import { mapTask, type TaskCollectionItem } from "@/data/tasks/tasksData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { useTeamsCollection } from "@/data/teams/teamsData.app";

const taskMatchesIdentifier = (
  task: TaskCollectionItem,
  identifier: string,
  teamIdentifier: string | null,
) => {
  const canonical = identifier.trim().toUpperCase();
  return (
    task.identifier === canonical ||
    task.previousIdentifiers.includes(canonical) ||
    (teamIdentifier !== null && `${teamIdentifier}-${task.number}` === canonical)
  );
};

/**
 * Resolves a single Task by id through its own `tasks.by_id` subscription, then
 * resolves that Task's owning Team through its own `teams.by_id` subscription to
 * format the "TEAM-123" identifier. A component that renders one Task looks up
 * exactly that Task (and its Team) rather than scanning the church-wide
 * collections. Zero dedupes identical subscriptions, so many components asking
 * for the same Task share one query.
 */
export function useTask(params: { readonly churchId: string | null; readonly taskId: string }) {
  const [taskRow] = useQuery(
    queries.tasks.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: params.taskId,
    }),
    { enabled: params.churchId !== null },
  );
  const task = taskRow ?? null;

  const [teamRow] = useQuery(
    queries.teams.by_id({
      church_id: params.churchId ?? "__no_church__",
      id: task?.team_id ?? "__no_team__",
    }),
    { enabled: params.churchId !== null && task !== null },
  );

  const state = recordFromQueryResult(task);
  const teamsById = teamRow ? new Map([[teamRow.id, teamRow]]) : new Map();

  return {
    loading: state.loading,
    taskOpt: state.record === null ? null : mapTask(state.record, teamsById),
  };
}

/**
 * Resolve a Task by its Task Identifier ("PRD-48", case-insensitive) through
 * Zero-backed Task and Team rows. Current Team identifiers win; previous
 * aliases are retained on the Task row for URL normalization after team moves.
 */
export function useTaskByIdentifier(params: {
  readonly churchId: string | null;
  readonly identifier: string;
}) {
  const parsed = parseTaskIdentifier(params.identifier);
  const tasks = useTasksCollection({
    churchId: params.churchId,
    currentUserId: null,
    listArgs: parsed ? undefined : { limit: 0 },
  });
  const teams = useTeamsCollection({ churchId: params.churchId });
  const teamIdentifierById = new Map(
    teams.teamsCollection.map((team) => [team.id, team.identifier.toUpperCase()]),
  );
  const taskOpt =
    params.churchId === null || parsed === null
      ? null
      : (tasks.tasksCollection.find((task) =>
          taskMatchesIdentifier(
            task,
            params.identifier,
            teamIdentifierById.get(task.teamId) ?? null,
          ),
        ) ?? null);

  return {
    loading: false,
    taskOpt,
  };
}
