import type { ColumnDef } from "@tanstack/react-table";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { ColumnHeader } from "@/components/collections/collectionComponents";
import { createColumnConfigHelper } from "@/components/data-table-filter/core/filters";
import { OrgLink } from "@/components/navigation/links";
import { Badge } from "@/components/ui/badge";
import type { OrgCollectionItem } from "@/data/orgs/orgsData.app";

const dtf = createColumnConfigHelper<OrgCollectionItem>();

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

const churchTimeZoneOptions = [
  { label: "Eastern", value: "America/New_York" },
  { label: "Central", value: "America/Chicago" },
  { label: "Mountain", value: "America/Denver" },
  { label: "Pacific", value: "America/Los_Angeles" },
  { label: "Alaska", value: "America/Anchorage" },
  { label: "Hawaii", value: "Pacific/Honolulu" },
] as const;

const usStateOptions = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
].map((state) => ({ label: state, value: state }));

const churchSizeOptions = ["1-50", "51-100", "101-250", "251-500", "501-1000", "1000+"].map(
  (size) => ({ label: size, value: size }),
);

const onboardingOptions = [
  { label: "Complete", value: "true" },
  { label: "Incomplete", value: "false" },
] as const;

export const orgsFiltersDef = [
  dtf
    .text()
    .id("name")
    .accessor((org) => org.name)
    .displayName("Name")
    .hidden()
    .build(),
  dtf
    .option()
    .id("churchTimeZone")
    .accessor((org) => org.churchTimeZone)
    .displayName("Church Time Zone")
    .options(churchTimeZoneOptions)
    .build(),
  dtf
    .option()
    .id("state")
    .accessor((org) => org.state)
    .displayName("State")
    .options(usStateOptions)
    .build(),
  dtf
    .option()
    .id("size")
    .accessor((org) => org.size)
    .displayName("Size")
    .options(churchSizeOptions)
    .build(),
  dtf
    .option()
    .id("completedOnboarding")
    .accessor((org) => org.completedOnboarding)
    .displayName("Onboarding")
    .options(onboardingOptions)
    .build(),
  dtf
    .date()
    .id("createdAt")
    .accessor((org) => org.createdAt)
    .displayName("Created")
    .build(),
] as const;

export const orgsColumnsDef: Array<ColumnDef<OrgCollectionItem>> = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="group/cell flex min-w-0 items-center gap-3">
        <BaseAvatar _tag="org" avatar={row.original.logo} name={row.original.name} size={32} />
        <OrgLink
          className="font-medium hover:underline"
          org={{ id: row.original.id, name: row.original.name }}
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
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column}>Members</ColumnHeader>,
    id: "membersCount",
    minSize: 110,
    size: 120,
  },
  {
    accessorKey: "teamsCount",
    cell: ({ row }) => row.original.teamsCount ?? 0,
    enableHiding: false,
    enableSorting: false,
    header: ({ column }) => <ColumnHeader column={column}>Teams</ColumnHeader>,
    id: "teamsCount",
    minSize: 100,
    size: 110,
  },
  {
    accessorKey: "state",
    cell: ({ row }) => formatLocation(row.original),
    enableHiding: false,
    enableSorting: false,
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
