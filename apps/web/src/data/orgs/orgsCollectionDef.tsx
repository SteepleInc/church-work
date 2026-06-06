import type { ColumnDef } from "@tanstack/react-table";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { ColumnHeader } from "@/components/collections/collectionComponents";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";

export const orgsColumnsDef: Array<ColumnDef<OrgCollectionItem>> = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <BaseAvatar _tag="org" avatar={row.original.logo} name={row.original.name} size={32} />
        <a className="truncate font-medium underline" href={`/admin/orgs?orgId=${row.original.id}`}>
          {row.original.name}
        </a>
      </div>
    ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Name</ColumnHeader>,
    id: "name",
    minSize: 220,
    size: 320,
  },
];

export const orgsFiltersDef = [] as const;
