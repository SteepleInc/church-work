import type { ColumnDef } from "@tanstack/react-table";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { ColumnHeader } from "@/components/collections/collectionComponents";
import { createColumnConfigHelper } from "@/components/data-table-filter/core/filters";
import type { ColumnOption } from "@/components/data-table-filter/core/types";
import { UserLink } from "@/components/navigation/links";
import { Badge } from "@/components/ui/badge";
import { formatCreatedAt } from "@/data/orgs/orgsCollectionDef";
import type { UserCollectionItem } from "@/data/users/usersData.app";

const dtf = createColumnConfigHelper<UserCollectionItem>();

export function createUsersFiltersDef(churchOptions: readonly ColumnOption[]) {
  return [
    dtf
      .text()
      .id("name")
      .accessor((user) => user.name)
      .displayName("Name")
      .hidden()
      .build(),
    dtf
      .text()
      .id("email")
      .accessor((user) => user.email)
      .displayName("Email")
      .hidden()
      .build(),
    dtf
      .multiOption()
      .id("churches")
      .accessor((user) => user.churches.map((church) => church.id))
      .displayName("Churches")
      .options(churchOptions)
      .build(),
  ] as const;
}

export const usersColumnsDef: Array<ColumnDef<UserCollectionItem>> = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="group/cell flex min-w-0 items-center gap-3">
        <BaseAvatar avatar={row.original.image} name={row.original.name ?? null} size={32} />
        <UserLink
          className="font-medium hover:underline"
          user={{ id: row.original.id, name: row.original.name || row.original.email }}
        />
      </div>
    ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Name</ColumnHeader>,
    id: "name",
    minSize: 220,
    size: 320,
  },
  {
    accessorKey: "email",
    cell: ({ row }) => row.original.email,
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Email</ColumnHeader>,
    id: "email",
    minSize: 220,
    size: 280,
  },
  {
    accessorKey: "churches",
    cell: ({ row }) =>
      row.original.churches.length > 0 ? (
        <div className="flex max-w-80 flex-wrap gap-1.5">
          {row.original.churches.map((church) => (
            <Badge key={church.id} variant="outline">
              {church.name}
            </Badge>
          ))}
        </div>
      ) : (
        "-"
      ),
    enableHiding: false,
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column}>Churches</ColumnHeader>,
    id: "churches",
    minSize: 240,
    size: 360,
  },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => formatCreatedAt(row.original.createdAt),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Created</ColumnHeader>,
    id: "createdAt",
    minSize: 130,
    size: 150,
  },
];
