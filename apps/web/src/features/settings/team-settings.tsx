import type { ColumnDef } from "@tanstack/react-table";
import { Check, ChevronDown, MoreHorizontal, PlusIcon, Search, UserRoundXIcon } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { SettingsColumnHeader, SettingsTable } from "@/components/collections/settingsTable";
import { useAppForm } from "@/components/form/ts-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxList,
  ComboboxOption,
  ComboboxPrimitive,
  PickerHeader,
  PickerPopup,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrgOpt, type CurrentOrg } from "@/data/orgs/orgData.app";
import {
  useAddTeamMemberMutation,
  useArchiveTeamMutation,
  useRemoveTeamMemberMutation,
  useRenameTeamMutation,
  useSetTeamIdentifierMutation,
  useTeamMembershipsCollection,
  useTeamsCollection,
  type TeamCollectionItem,
} from "@/data/teams/teamsData.app";
import {
  getUserDisplayName,
  useChurchUsersCollection,
  type UserCollectionItem,
} from "@/data/users/usersData.app";

type TeamRoleFilter = "all" | "admin" | "member";

const ROLE_FILTER_OPTIONS: readonly {
  readonly value: TeamRoleFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "member", label: "Members" },
];

const memberRoleLabel = (role: string | undefined): string => {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
};

const matchesTeamMemberFilter = (member: UserCollectionItem, value: string): boolean => {
  if (!value) return true;
  const needle = value.toLowerCase();
  return (
    (member.name ?? "").toLowerCase().includes(needle) ||
    (member.email ?? "").toLowerCase().includes(needle)
  );
};

const matchesRoleFilter = (member: UserCollectionItem, filter: TeamRoleFilter): boolean => {
  if (filter === "all") return true;
  if (filter === "admin") return member.role === "admin" || member.role === "owner";
  return member.role !== "admin" && member.role !== "owner";
};

function canManageTeams(role: string | readonly string[]) {
  return Array.isArray(role)
    ? role.includes("owner") || role.includes("admin")
    : role === "owner" || role === "admin";
}

/** Resolve a single Team within the Active Church by its id. */
export function useTeamById(teamId: string) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;

  return {
    activeChurch,
    loading: orgLoading || teams.loading,
    team,
  };
}

export function TeamGeneralPanel({ teamId }: { readonly teamId: string }) {
  const { activeChurch, loading, team } = useTeamById(teamId);

  if (loading) {
    return <Skeleton className="h-9 w-full max-w-md" />;
  }

  if (!activeChurch || !team) {
    return <p className="text-muted-foreground text-sm">Team not found.</p>;
  }

  return <TeamGeneralForm activeChurch={activeChurch} key={team.id} team={team} />;
}

function TeamGeneralForm({
  activeChurch,
  team,
}: {
  readonly activeChurch: CurrentOrg;
  readonly team: TeamCollectionItem;
}) {
  const renameTeam = useRenameTeamMutation();
  const setIdentifier = useSetTeamIdentifierMutation();
  const archiveTeam = useArchiveTeamMutation();
  const canManage = canManageTeams(activeChurch.role);

  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const run = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ) => {
    setError(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Team.");
      return;
    }

    toast.success(successMessage);
  };

  const nameForm = useAppForm({
    defaultValues: { name: team.name },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (!canManage || !name || name === team.name) return;
      await run("rename", () => renameTeam({ name, teamId: team.id }), "Team renamed.");
    },
  });

  const identifierForm = useAppForm({
    defaultValues: { identifier: team.identifier },
    onSubmit: async ({ value }) => {
      const identifier = value.identifier.trim().toUpperCase();
      if (!canManage || !identifier || identifier === team.identifier) return;
      await run(
        "identifier",
        () => setIdentifier({ identifier, teamId: team.id }),
        "Team identifier updated.",
      );
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!canManage ? (
        <Alert>
          <AlertDescription>Only Church owners and admins can change Teams.</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void nameForm.handleSubmit();
        }}
      >
        <Label htmlFor="team-name">Name</Label>
        <div className="flex items-center gap-2">
          <nameForm.Field name="name">
            {(field) => (
              <Input
                className="max-w-md"
                disabled={!canManage || pendingAction === "rename"}
                id="team-name"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.currentTarget.value)}
                value={field.state.value}
              />
            )}
          </nameForm.Field>
          <nameForm.Subscribe selector={(state) => state.values.name}>
            {(name) => (
              <Button
                disabled={!canManage || !name.trim() || name.trim() === team.name}
                loading={pendingAction === "rename"}
                type="submit"
                variant="outline"
              >
                Save
              </Button>
            )}
          </nameForm.Subscribe>
        </div>
      </form>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void identifierForm.handleSubmit();
        }}
      >
        <Label htmlFor="team-identifier">Identifier</Label>
        <p className="text-muted-foreground text-sm">Used in Task IDs.</p>
        <div className="flex items-center gap-2">
          <identifierForm.Field name="identifier">
            {(field) => (
              <Input
                className="max-w-xs uppercase"
                disabled={!canManage || pendingAction === "identifier"}
                id="team-identifier"
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.currentTarget.value.toUpperCase())}
                value={field.state.value}
              />
            )}
          </identifierForm.Field>
          <identifierForm.Subscribe selector={(state) => state.values.identifier}>
            {(identifier) => (
              <Button
                disabled={
                  !canManage ||
                  !identifier.trim() ||
                  identifier.trim().toUpperCase() === team.identifier
                }
                loading={pendingAction === "identifier"}
                type="submit"
                variant="outline"
              >
                Save
              </Button>
            )}
          </identifierForm.Subscribe>
        </div>
      </form>

      {canManage ? (
        <div className="flex flex-col gap-2 border-destructive/30 border-t pt-6">
          <span className="font-medium text-sm">Archive Team</span>
          <p className="text-muted-foreground text-sm">
            Archiving removes the Team from active work areas.
          </p>
          <Button
            className="w-fit"
            loading={pendingAction === "archive"}
            onClick={() =>
              void run(
                "archive",
                () => archiveTeam({ teamId: team.id }),
                `Archived Team ${team.name}.`,
              )
            }
            type="button"
            variant="destructive"
          >
            Archive {team.name}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Linear-style Team Members settings: a search + role-filter toolbar with an
 * "Add a member" picker, and a dense table of the Team's members (avatar, name,
 * email, org Role) with a trailing "..." menu to remove a member. Mirrors the
 * workspace Members settings table so both surfaces share one visual language.
 */
export function TeamMembersPanel({ teamId }: { readonly teamId: string }) {
  const { currentOrgOpt: activeChurch, loading: orgLoading } = useCurrentOrgOpt();
  const teams = useTeamsCollection({ churchId: activeChurch?.id ?? null });
  const memberships = useTeamMembershipsCollection({ churchId: activeChurch?.id ?? null });
  const members = useChurchUsersCollection({ churchId: activeChurch?.id ?? null });
  const addTeamMember = useAddTeamMemberMutation();
  const removeTeamMember = useRemoveTeamMemberMutation();

  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<TeamRoleFilter>("all");

  const team = teams.teamsCollection.find((candidate) => candidate.id === teamId) ?? null;
  const canManage = activeChurch ? canManageTeams(activeChurch.role) : false;

  const membersById = new Map(members.usersCollection.map((member) => [member.id, member]));
  const teamMemberUserIds = new Set(
    memberships.teamMembershipsCollection
      .filter((membership) => membership.teamId === team?.id)
      .map((membership) => membership.userId),
  );
  const teamMembers = members.usersCollection.filter((member) => teamMemberUserIds.has(member.id));
  const availableMembers = members.usersCollection.filter(
    (member) => !teamMemberUserIds.has(member.id),
  );
  const filteredMembers = teamMembers.filter(
    (member) => matchesTeamMemberFilter(member, filter) && matchesRoleFilter(member, roleFilter),
  );

  const run = async (
    action: string,
    mutation: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ) => {
    setError(null);
    setPendingAction(action);
    const result = await mutation();
    setPendingAction(null);

    if (!result.ok) {
      setError(result.error?.message ?? "Could not update Team Membership.");
      return;
    }

    toast.success(successMessage);
  };

  const addMemberForm = useAppForm({
    defaultValues: { userId: "" },
    onSubmit: async ({ value, formApi }) => {
      if (!activeChurch || !team || !value.userId) return;
      const member = membersById.get(value.userId);
      await run(
        "add",
        () => addTeamMember({ teamId: team.id, userId: value.userId }),
        `Added ${member ? getUserDisplayName(member) : "member"} to ${team.name}.`,
      );
      formApi.reset();
    },
  });

  const columns = useMemo<Array<ColumnDef<UserCollectionItem>>>(
    () => [
      {
        accessorFn: (member) => getUserDisplayName(member),
        cell: ({ row }) => {
          const member = row.original;
          const name = getUserDisplayName(member);
          const subtitle = member.email && member.email !== name ? member.email : null;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <BaseAvatar avatar={member.image} name={name} size={28} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-sm">{name}</span>
                {subtitle ? (
                  <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
                ) : null}
              </div>
            </div>
          );
        },
        header: ({ column }) => <SettingsColumnHeader column={column}>Name</SettingsColumnHeader>,
        id: "name",
        meta: { className: "min-w-56" },
      },
      {
        accessorFn: (member) => member.email ?? "",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.email ?? "—"}
          </span>
        ),
        header: ({ column }) => <SettingsColumnHeader column={column}>Email</SettingsColumnHeader>,
        id: "email",
        meta: { className: "min-w-48" },
      },
      {
        accessorFn: (member) => member.role ?? "member",
        cell: ({ row }) => <Badge variant="secondary">{memberRoleLabel(row.original.role)}</Badge>,
        header: ({ column }) => <SettingsColumnHeader column={column}>Role</SettingsColumnHeader>,
        id: "role",
        meta: { className: "w-28" },
      },
    ],
    [],
  );

  if (orgLoading || teams.loading || memberships.loading || members.loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-14 w-full rounded-lg" key={index} />
        ))}
      </div>
    );
  }

  if (!activeChurch || !team) {
    return <p className="text-muted-foreground text-sm">Team not found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              onChange={(event) => setFilter(event.currentTarget.value)}
              placeholder="Search by name or email"
              value={filter}
            />
          </div>
          <RoleFilterMenu onChange={setRoleFilter} value={roleFilter} />
        </div>
        {canManage ? (
          <AddTeamMemberPicker
            availableMembers={availableMembers}
            disabled={pendingAction === "add"}
            onSelect={(userId) => {
              addMemberForm.setFieldValue("userId", userId);
              void addMemberForm.handleSubmit();
            }}
          />
        ) : null}
      </div>

      {!canManage ? (
        <p className="text-muted-foreground text-sm">
          Only Church owners and admins can change Team Memberships.
        </p>
      ) : null}

      <SettingsTable<UserCollectionItem>
        columnsDef={columns}
        data={filteredMembers}
        emptyState={
          <p className="px-3 py-6 text-muted-foreground text-sm">
            {teamMembers.length === 0
              ? "No members on this Team yet."
              : "No members match your search."}
          </p>
        }
        getRowId={(member) => member.id}
        initialSorting={[{ desc: false, id: "name" }]}
        rowActions={
          canManage
            ? (member) => (
                <TeamMemberRowActions
                  disabled={pendingAction === `remove-${member.id}`}
                  onRemove={() =>
                    void run(
                      `remove-${member.id}`,
                      () => removeTeamMember({ teamId: team.id, userId: member.id }),
                      `Removed ${getUserDisplayName(member)} from ${team.name}.`,
                    )
                  }
                />
              )
            : undefined
        }
      />
    </div>
  );
}

function RoleFilterMenu({
  value,
  onChange,
}: {
  readonly value: TeamRoleFilter;
  readonly onChange: (value: TeamRoleFilter) => void;
}) {
  const current = ROLE_FILTER_OPTIONS.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="gap-1.5" type="button" variant="outline">
            {current?.label ?? "All"}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-44">
        {ROLE_FILTER_OPTIONS.map((option) => (
          <DropdownMenuItem
            className="justify-between"
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.value === value ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Add a member" picker for a Team: a Linear-style combobox of Church Members
 * not already on the Team. Selecting a member adds them; the picker is disabled
 * once every Church Member belongs to the Team.
 */
function AddTeamMemberPicker({
  availableMembers,
  disabled,
  onSelect,
}: {
  readonly availableMembers: readonly UserCollectionItem[];
  readonly disabled: boolean;
  readonly onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const items = useMemo(() => availableMembers.map((member) => member.id), [availableMembers]);
  const labelFor = useMemo(() => {
    const lookup = new Map(
      availableMembers.map((member) => [member.id, getUserDisplayName(member)] as const),
    );
    return (candidate: string) => lookup.get(candidate) ?? candidate;
  }, [availableMembers]);
  const isDisabled = disabled || availableMembers.length === 0;

  return (
    <Combobox<string>
      disabled={isDisabled}
      items={items}
      itemToStringLabel={labelFor}
      onOpenChange={setOpen}
      onValueChange={(next) => {
        if (next) onSelect(next);
        setOpen(false);
      }}
      open={open}
      value=""
    >
      <ComboboxPrimitive.Trigger
        render={
          <Button disabled={isDisabled} type="button">
            <PlusIcon data-icon="inline-start" />
            Add a member
          </Button>
        }
      />
      <PickerPopup align="end" width="lg">
        <PickerHeader inputProps={{ "aria-controls": listId }} placeholder="Add a member..." />
        <ComboboxEmpty>
          {availableMembers.length === 0 ? "All members are on this Team." : "No members found."}
        </ComboboxEmpty>
        <ComboboxList id={listId}>
          {availableMembers.map((member) => {
            const name = getUserDisplayName(member);
            return (
              <ComboboxOption key={member.id} selected={false} value={member.id}>
                <BaseAvatar avatar={member.image} name={name} size={20} />
                <span className="truncate">{name}</span>
              </ComboboxOption>
            );
          })}
        </ComboboxList>
      </PickerPopup>
    </Combobox>
  );
}

/**
 * The trailing per-row "..." actions menu for a Team member: a single "Remove
 * from Team" action that mirrors the workspace Members row menu.
 */
function TeamMemberRowActions({
  disabled,
  onRemove,
}: {
  readonly disabled: boolean;
  readonly onRemove: () => void;
}): ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open member actions"
            className="opacity-0 group-hover/row:opacity-100 aria-expanded:opacity-100"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48" side="bottom">
        <DropdownMenuItem disabled={disabled} onClick={onRemove} variant="destructive">
          <UserRoundXIcon />
          Remove from Team...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
