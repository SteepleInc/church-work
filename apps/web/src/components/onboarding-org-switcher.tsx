import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateOrg } from "@/data/useCreateOrg";
import { useChangeOrg } from "@/data/useChangeOrg";
import { useOrgId } from "@/data/useOrgId";
import { type OrgCollectionItem, useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { cn } from "@/lib/utils";

export function getOnboardingOrgSwitcherLabel(params: { readonly currentOrgName: string | null }) {
  return params.currentOrgName ?? "Creating new Church...";
}

export function OnboardingOrgSwitcher({ className }: { readonly className?: string }) {
  const { orgsCollection, loading } = useUserOrgsCollection();
  const orgId = useOrgId();
  const [search, setSearch] = useState("");
  const { changeOrg, isChangingOrg } = useChangeOrg();
  const { createOrg } = useCreateOrg();
  const currentOrg = orgsCollection.find((org) => org.id === orgId) ?? null;
  const hasMultipleOrgs = orgsCollection.length > 1;
  const filteredOrgs = orgsCollection.filter((org) =>
    org.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  if (loading) {
    return null;
  }

  if (!orgsCollection.length) {
    return (
      <div
        className={cn(
          "flex h-auto w-full items-center gap-3 rounded-lg bg-background/10 px-3 py-2 text-background dark:bg-foreground/10 dark:text-foreground",
          className,
        )}
      >
        <Plus className="size-4" />
        <span className="truncate font-semibold">
          {getOnboardingOrgSwitcherLabel({ currentOrgName: null })}
        </span>
      </div>
    );
  }

  if (!hasMultipleOrgs) {
    return (
      <div
        className={cn(
          "flex h-auto w-full items-center gap-3 rounded-lg bg-background/10 px-3 py-2 text-background dark:bg-foreground/10 dark:text-foreground",
          className,
        )}
      >
        <ChurchInitials name={currentOrg?.name ?? "Church"} />
        <span className="truncate font-semibold">
          {getOnboardingOrgSwitcherLabel({ currentOrgName: currentOrg?.name ?? null })}
        </span>
      </div>
    );
  }

  const handleOrgClick = async (org: OrgCollectionItem) => {
    await changeOrg({ completedOnboarding: org.completedOnboarding, orgId: org.id });
  };

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="h-auto w-full justify-start gap-3 bg-background/10 px-3 py-2 text-background hover:bg-background/20 hover:text-background dark:bg-foreground/10 dark:text-foreground dark:hover:bg-foreground/20 dark:hover:text-foreground"
              variant="ghost"
            />
          }
        >
          <ChurchInitials name={currentOrg?.name ?? "Church"} />
          <span className="truncate font-semibold">
            {getOnboardingOrgSwitcherLabel({ currentOrgName: currentOrg?.name ?? null })}
          </span>
          <ChevronsUpDown className="ml-auto size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="flex min-w-56 flex-col rounded-lg p-0">
          {orgsCollection.length > 5 ? (
            <Input
              className="shrink-0 rounded-none border-x-0 border-t-0"
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search Churches..."
              value={search}
            />
          ) : null}

          <div className="flex overflow-hidden">
            <ScrollArea className="w-full" viewportClassName="p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Your Churches
                </DropdownMenuLabel>
                {filteredOrgs.map((org) => (
                  <DropdownMenuItem
                    className="gap-2"
                    disabled={isChangingOrg}
                    key={org.id}
                    onClick={() => handleOrgClick(org)}
                  >
                    <ChurchInitials name={org.name} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-1">{org.name}</span>
                      {!org.completedOnboarding ? (
                        <span className="text-muted-foreground text-xs">Onboarding incomplete</span>
                      ) : null}
                    </div>
                    {org.id === orgId ? <Check className="ml-auto size-4" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createOrg}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Create Church</div>
              </DropdownMenuItem>
            </ScrollArea>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChurchInitials({ name }: { readonly name: string }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground text-xs font-semibold dark:bg-foreground dark:text-background">
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </div>
  );
}
