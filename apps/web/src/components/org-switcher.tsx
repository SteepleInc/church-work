import { useState } from "react";

import { CheckCircleIcon } from "@/components/icons/checkCircleIcon";
import { ChevronDownIcon } from "@/components/icons/chevronDownIcon";
import { PlusIcon } from "@/components/icons/plusIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateOrg } from "@/data/useCreateOrg";
import { useChangeOrg } from "@/data/useChangeOrg";
import { useOrgId } from "@/data/useOrgId";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { type OrgCollectionItem, useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { getFilteredOrgSwitcherItems } from "@/components/org-switcher-utils";

export function OrgSwitcher() {
  const { currentOrgOpt, loading: currentOrgLoading } = useCurrentOrgOpt();
  const { orgsCollection } = useUserOrgsCollection();
  const [search, setSearch] = useState("");
  const { createOrg } = useCreateOrg();
  const filteredOrgs = getFilteredOrgSwitcherItems({ orgs: orgsCollection, search });

  if (currentOrgLoading && !currentOrgOpt) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="pointer-events-none cursor-default" size="lg">
            <Skeleton className="size-8 shrink-0 rounded-lg bg-muted-foreground/20" />
            <div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
              <Skeleton className="h-3 w-24 bg-muted-foreground/20" />
              <Skeleton className="h-2.5 w-16 bg-muted-foreground/20" />
            </div>
            <ChevronDownIcon className="ml-auto size-4 text-muted-foreground/40" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                size="lg"
              />
            }
          >
            <ChurchAvatar name={currentOrgOpt?.name ?? "No Name"} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{currentOrgOpt?.name ?? "No Name"}</span>
              <span className="truncate text-muted-foreground text-xs capitalize">Church</span>
            </div>
            <ChevronDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="flex w-(--anchor-width) min-w-56 flex-col rounded-lg p-0"
            side="bottom"
            sideOffset={4}
          >
            {orgsCollection.length > 5 ? (
              <Input
                className="shrink-0"
                onChange={(event) => setSearch(event.currentTarget.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Search"
                value={search}
              />
            ) : null}

            <div className="flex overflow-hidden">
              <ScrollArea className="w-full" viewportClassName="p-1">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Your Churches
                </DropdownMenuLabel>
                {filteredOrgs.map((org) => (
                  <OrgDropdownItem key={org.id} org={org} />
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={createOrg}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <PlusIcon className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Create Church</div>
                </DropdownMenuItem>
              </ScrollArea>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function OrgDropdownItem({ org }: { readonly org: OrgCollectionItem }) {
  const { setOpenMobile } = useSidebar();
  const orgId = useOrgId();
  const { changeOrg, isChangingOrg } = useChangeOrg();

  const handleOrgClick = async () => {
    setOpenMobile(false);
    await changeOrg({ completedOnboarding: org.completedOnboarding, orgId: org.id });
  };

  return (
    <DropdownMenuItem className="gap-2" disabled={isChangingOrg} onClick={handleOrgClick}>
      <ChurchAvatar name={org.name} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2">{org.name}</span>
        {!org.completedOnboarding ? (
          <span className="text-muted-foreground text-xs">Onboarding incomplete</span>
        ) : null}
      </span>
      {org.id === orgId ? <CheckCircleIcon className="ml-auto size-4" /> : null}
    </DropdownMenuItem>
  );
}

function ChurchAvatar({
  name,
  size = "md",
}: {
  readonly name: string;
  readonly size?: "md" | "sm";
}) {
  return (
    <div
      className={
        size === "md"
          ? "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          : "flex size-6 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-semibold"
      }
    >
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </div>
  );
}
