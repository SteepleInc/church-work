import { parseTaskIdentifier } from "@church-task/domain";

import { type TaskCollectionItem } from "@/data/tasks/tasksData.app";
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
