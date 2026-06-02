import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanMoveEvent,
} from "@/components/reui/kanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GripVerticalIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

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
          <TaskKanbanColumn
            key={column.id}
            column={column}
            value={column.id}
            tasks={columnTasks[column.id] ?? []}
          />
        ))}
      </KanbanBoard>
      <KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
    </Kanban>
  );
}

interface TaskKanbanColumnProps extends Omit<
  ComponentProps<typeof KanbanColumn>,
  "children" | "value"
> {
  readonly column: TaskBoardColumn;
  readonly tasks: readonly TaskBoardTask[];
  readonly value: string;
  readonly isOverlay?: boolean;
}

function TaskKanbanColumn({ column, tasks, value, isOverlay, ...props }: TaskKanbanColumnProps) {
  return (
    <KanbanColumn value={value} aria-label={`Workflow Status ${column.title}`} {...props}>
      <Card className="mb-2.5 h-full min-w-64 bg-muted/25">
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="truncate text-sm font-semibold">{column.title}</span>
              <Badge variant="outline">{tasks.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {column.taskState.replace("_", " ")}
            </p>
          </div>
          <KanbanColumnHandle
            render={(handleProps) => (
              <Button
                {...handleProps}
                size="icon-xs"
                variant="ghost"
                aria-label={`Move ${column.title}`}
              >
                <GripVerticalIcon />
              </Button>
            )}
          />
        </CardHeader>
        <CardContent className="px-3">
          <KanbanColumnContent
            value={value}
            className="flex min-h-24 flex-col gap-2.5"
            aria-label={`${column.title} Tasks`}
          >
            {tasks.map((task) => (
              <TaskKanbanCard
                key={task.id}
                task={task}
                asHandle={!isOverlay}
                isOverlay={isOverlay}
              />
            ))}
          </KanbanColumnContent>
        </CardContent>
      </Card>
    </KanbanColumn>
  );
}

interface TaskKanbanCardProps extends Omit<
  ComponentProps<typeof KanbanItem>,
  "children" | "value"
> {
  readonly task: TaskBoardTask;
  readonly asHandle?: boolean;
  readonly isOverlay?: boolean;
}

function TaskKanbanCard({ task, asHandle, isOverlay, className, ...props }: TaskKanbanCardProps) {
  const cardContent = (
    <Card className={cn("shadow-xs", task.taskState === "canceled" && "opacity-70", className)}>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="line-clamp-2 text-sm leading-snug">{task.title}</CardTitle>
      </CardHeader>
      {task.parentTask ? (
        <CardContent className="px-3 pb-3 pt-0">
          <p className="line-clamp-1 text-xs text-muted-foreground">
            Parent: {task.parentTask.title}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );

  return (
    <KanbanItem
      value={task.id}
      disabled={task.taskState === "canceled"}
      aria-label={`Task card ${task.title}`}
      {...props}
    >
      {asHandle && !isOverlay ? <KanbanItemHandle>{cardContent}</KanbanItemHandle> : cardContent}
    </KanbanItem>
  );
}
