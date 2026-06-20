import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { LibraryBig } from "lucide-react";

import { ColumnHeader } from "@/components/collections/collectionComponents";
import { Badge } from "@/components/ui/badge";
import type { TemplateCollectionItem } from "@/data/templates/templatesData.app";
import { templateScheduleKindLabel } from "@/data/templates/templatesData.app";

function formatShapeLabel(template: TemplateCollectionItem): string {
  if (template.placementShape === "weekly_service") return "Weekly service";
  if (template.placementShape === "key_date") return "Key Date";
  return templateScheduleKindLabel(template.recurrence);
}

export const templatesColumnsDef: Array<ColumnDef<TemplateCollectionItem>> = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="group/cell flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <LibraryBig className="size-4" />
        </span>
        <Link
          className="truncate font-medium hover:underline"
          params={{ templateId: row.original.id }}
          to="/templates/$templateId"
        >
          {row.original.name}
        </Link>
      </div>
    ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Name</ColumnHeader>,
    id: "name",
    minSize: 220,
    size: 320,
  },
  {
    accessorFn: (template) => formatShapeLabel(template),
    cell: ({ row }) => <Badge variant="secondary">{formatShapeLabel(row.original)}</Badge>,
    enableHiding: false,
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column}>Shape</ColumnHeader>,
    id: "shape",
    minSize: 140,
    size: 170,
  },
  {
    accessorKey: "scheduleCount",
    cell: ({ row }) =>
      row.original.scheduleCount === 0 ? (
        <span className="text-muted-foreground">Unscheduled</span>
      ) : (
        `${row.original.scheduleCount} schedule${row.original.scheduleCount === 1 ? "" : "s"}`
      ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Schedules</ColumnHeader>,
    id: "scheduleCount",
    minSize: 130,
    size: 160,
  },
  {
    accessorKey: "taskCount",
    cell: ({ row }) => `${row.original.taskCount} task${row.original.taskCount === 1 ? "" : "s"}`,
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Tasks</ColumnHeader>,
    id: "taskCount",
    minSize: 110,
    size: 130,
  },
];
