import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  type KanbanMoveEvent,
} from "@/components/reui/kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

import {
  buildTaskBoardColumns,
  groupTasksByWorkflowStatus,
  moveTaskBetweenBoardColumns,
  type TaskBoardColumn,
  type TaskBoardColumns,
  type TaskBoardTask,
  type TaskBoardWorkflowStatus,
} from "./task-kanban-adapter";

type TaskKanbanBoardProps = {
  readonly workflowStatuses: readonly TaskBoardWorkflowStatus[];
  readonly tasks: readonly TaskBoardTask[];
  readonly onMoveTask: (move: {
    readonly taskId: string;
    readonly workflowStatusId: string;
  }) => void | Promise<void>;
  readonly className?: string;
};

export function TaskKanbanBoard({
  workflowStatuses,
  tasks,
  onMoveTask,
  className,
}: TaskKanbanBoardProps) {
  const columns = buildTaskBoardColumns(workflowStatuses);
  const initialColumnTasks = groupTasksByWorkflowStatus(columns, tasks);
  const boardKey = [
    ...columns.map((column) => `${column.id}:${column.title}`),
    ...tasks.map((task) => `${task.id}:${task.workflowStatusId}:${task.taskState}`),
  ].join(":");

  return (
    <StatefulTaskKanbanBoard
      key={boardKey}
      columns={columns}
      initialColumnTasks={initialColumnTasks}
      onMoveTask={onMoveTask}
      className={className}
    />
  );
}

function StatefulTaskKanbanBoard({
  columns,
  initialColumnTasks,
  onMoveTask,
  className,
}: {
  readonly columns: readonly TaskBoardColumn[];
  readonly initialColumnTasks: TaskBoardColumns;
  readonly onMoveTask: TaskKanbanBoardProps["onMoveTask"];
  readonly className?: string;
}) {
  const [columnTasks, setColumnTasks] = useState(initialColumnTasks);

  const handleMove = (event: KanbanMoveEvent) => {
    setColumnTasks((currentColumns) =>
      moveTaskBetweenBoardColumns({
        columns: currentColumns,
        taskId: String(event.event.active.id),
        destinationWorkflowStatusId: event.overContainer,
        destinationIndex: event.overIndex,
        persistMove: onMoveTask,
      }),
    );
  };

  return (
    <Kanban
      value={columnTasks}
      onValueChange={setColumnTasks}
      getItemValue={(task) => task.id}
      onMove={handleMove}
      className={className}
    >
      <KanbanBoard className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2 sm:grid-cols-none">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            value={column.id}
            aria-label={`Workflow Status ${column.title}`}
          >
            <div className="mb-3 flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {column.taskState.replace("_", " ")}
                </p>
              </div>
              <Badge variant="secondary">{columnTasks[column.id]?.length ?? 0}</Badge>
            </div>
            <KanbanColumnContent
              value={column.id}
              className="min-h-24"
              aria-label={`${column.title} Tasks`}
            >
              {(columnTasks[column.id] ?? []).map((task) => (
                <KanbanItem
                  key={task.id}
                  value={task.id}
                  disabled={task.taskState === "canceled"}
                  aria-label={`Task card ${task.title}`}
                >
                  <TaskKanbanCard task={task} />
                </KanbanItem>
              ))}
            </KanbanColumnContent>
          </KanbanColumn>
        ))}
      </KanbanBoard>
    </Kanban>
  );
}

function TaskKanbanCard({ task }: { readonly task: TaskBoardTask }) {
  return (
    <Card className={cn("shadow-xs", task.taskState === "canceled" && "opacity-70")}>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
      </CardHeader>
      {task.parentTask ? (
        <CardContent className="px-3 pb-3 pt-0">
          <p className="text-xs text-muted-foreground">Parent: {task.parentTask.title}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
