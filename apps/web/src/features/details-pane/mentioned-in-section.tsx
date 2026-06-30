import { useTaskBacklinksCollection } from "@/data/task-mentions/taskMentionsData.app";
import { useTask } from "@/data/tasks/taskData.app";

/**
 * "Mentioned in" backlinks: the other Tasks whose descriptions reference this
 * Task. Reads the live incoming mention edges, then renders one row per edge —
 * each row looks up its own source Task by id (see `MentionedInRow`), so the
 * section never depends on the church-wide Tasks collection.
 */
export function MentionedInSection({
  churchId,
  onOpenTask,
  taskId,
}: {
  readonly churchId: string | null;
  readonly onOpenTask: (identifier: string) => void;
  readonly taskId: string;
}) {
  const { taskBacklinksCollection } = useTaskBacklinksCollection({ churchId, taskId });

  // Distinct source Tasks, preserving edge order (created_at asc), excluding any
  // self-reference defensively.
  const sourceTaskIds: string[] = [];
  const seen = new Set<string>();
  for (const edge of taskBacklinksCollection) {
    const sourceId = edge.source_task_id;
    if (sourceId === null || sourceId === taskId || seen.has(sourceId)) continue;
    seen.add(sourceId);
    sourceTaskIds.push(sourceId);
  }

  if (sourceTaskIds.length === 0) return null;

  return (
    <section className="grid gap-2">
      <h3 className="font-medium text-muted-foreground text-xs">Mentioned in</h3>
      <ul className="grid gap-1.5">
        {sourceTaskIds.map((sourceTaskId) => (
          <MentionedInRow
            key={sourceTaskId}
            churchId={churchId}
            onOpenTask={onOpenTask}
            sourceTaskId={sourceTaskId}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * A single "mentioned in" backlink row. Looks up its own source Task by id and
 * renders the Task's current identifier and title. Renders nothing while the
 * Task is still loading or if it no longer resolves (deleted / inaccessible).
 */
function MentionedInRow({
  churchId,
  onOpenTask,
  sourceTaskId,
}: {
  readonly churchId: string | null;
  readonly onOpenTask: (identifier: string) => void;
  readonly sourceTaskId: string;
}) {
  const { taskOpt } = useTask({ churchId, taskId: sourceTaskId });

  if (taskOpt === null) return null;

  return (
    <li>
      <button
        className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-3 text-left text-sm transition-colors hover:bg-accent"
        onClick={() => onOpenTask(taskOpt.identifier)}
        type="button"
      >
        <span className="shrink-0 font-medium text-muted-foreground text-xs">
          {taskOpt.identifier}
        </span>
        <span className="truncate">{taskOpt.title}</span>
      </button>
    </li>
  );
}
