import type { ColumnDef } from "@tanstack/react-table";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { ColumnHeader } from "@/components/collections/collectionComponents";
import { Badge } from "@/components/ui/badge";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";

const urlProtocolRegex = /^https?:\/\//;
const trailingSlashRegex = /\/$/;

export function formatDisplayUrl(url: string) {
  return url.replace(urlProtocolRegex, "").replace(trailingSlashRegex, "");
}

export function formatLocation(org: Pick<OrgCollectionItem, "city" | "state" | "countryCode">) {
  const locationParts = [org.city, org.state, org.countryCode].filter(Boolean);

  return locationParts.length > 0 ? locationParts.join(", ") : "-";
}

export function formatCreatedAt(createdAt: number | undefined) {
  return createdAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(createdAt) : "-";
}

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
  {
    accessorKey: "slug",
    cell: ({ row }) => row.original.slug ?? "-",
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Slug</ColumnHeader>,
    id: "slug",
    minSize: 140,
    size: 180,
  },
  {
    accessorKey: "churchTimeZone",
    cell: ({ row }) => row.original.churchTimeZone ?? "-",
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Church Time Zone</ColumnHeader>,
    id: "churchTimeZone",
    minSize: 180,
    size: 220,
  },
  {
    accessorKey: "completedOnboarding",
    cell: ({ row }) => (
      <Badge variant={row.original.completedOnboarding ? "default" : "outline"}>
        {row.original.completedOnboarding ? "Complete" : "Incomplete"}
      </Badge>
    ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Onboarding</ColumnHeader>,
    id: "completedOnboarding",
    minSize: 140,
    size: 160,
  },
  {
    accessorKey: "membersCount",
    cell: ({ row }) => row.original.membersCount ?? 0,
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Members</ColumnHeader>,
    id: "membersCount",
    minSize: 110,
    size: 120,
  },
  {
    accessorKey: "teamsCount",
    cell: ({ row }) => row.original.teamsCount ?? 0,
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Teams</ColumnHeader>,
    id: "teamsCount",
    minSize: 100,
    size: 110,
  },
  {
    accessorKey: "state",
    cell: ({ row }) => formatLocation(row.original),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Location</ColumnHeader>,
    id: "location",
    minSize: 170,
    size: 220,
  },
  {
    accessorKey: "size",
    cell: ({ row }) =>
      row.original.size ? <Badge variant="outline">{row.original.size}</Badge> : "-",
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Size</ColumnHeader>,
    id: "size",
    minSize: 110,
    size: 140,
  },
  {
    accessorKey: "url",
    cell: ({ row }) =>
      row.original.url ? (
        <a
          className="text-primary hover:underline"
          href={row.original.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {formatDisplayUrl(row.original.url)}
        </a>
      ) : (
        "-"
      ),
    enableHiding: false,
    header: ({ column }) => <ColumnHeader column={column}>Website</ColumnHeader>,
    id: "website",
    minSize: 180,
    size: 220,
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

export const orgsFiltersDef = [] as const;
