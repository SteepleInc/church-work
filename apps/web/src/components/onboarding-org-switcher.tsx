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
import { type OrgCollectionItem, useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function OnboardingOrgSwitcher({ className }: { readonly className?: string }) {
  const { orgsCollection, loading } = useUserOrgsCollection();
  const { session } = useSession();
  const orgId = session?.session.activeOrganizationId ?? "";
  const [search, setSearch] = useState("");
  const { changeOrg, isChangingOrg } = useChangeOrg();
  const { createOrg } = useCreateOrg();
  const currentOrg = orgsCollection.find((org) => org.id === orgId) ?? null;
  const hasMultipleOrgs = orgsCollection.length > 1;
  const hasOrgs = orgsCollection.length > 0;
  const filteredOrgs = orgsCollection.filter((org) =>
    org.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const switcherContent = (
    <>
      {currentOrg ? (
        <>
          <ChurchInitials name={currentOrg.name} />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{currentOrg.name}</span>
            <span className="truncate text-xs opacity-70">Church</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex size-8 items-center justify-center rounded-md border border-onboarding-panel-foreground/30 border-dashed">
            <Plus className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Creating new Church...</span>
          </div>
        </>
      )}
      {hasMultipleOrgs ? <ChevronsUpDown className="ml-auto size-4" /> : null}
    </>
  );

  if (loading) {
    return null;
  }

  if (!hasOrgs) {
    return (
      <Link
        className={cn(
          "hidden text-onboarding-panel-foreground/70 transition-colors hover:text-onboarding-panel-foreground md:block",
          className,
        )}
        to="/"
      >
        Home
      </Link>
    );
  }

  if (!hasMultipleOrgs) {
    return (
      <div
        className={cn(
          "flex h-auto w-full items-center gap-3 rounded-lg bg-onboarding-panel-foreground/10 px-3 py-2 text-onboarding-panel-foreground",
          className,
        )}
      >
        {switcherContent}
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
              className="h-auto w-full justify-start gap-3 bg-onboarding-panel-foreground/10 px-3 py-2 text-onboarding-panel-foreground hover:bg-onboarding-panel-foreground/20 hover:text-onboarding-panel-foreground"
              contentWrapperClassName="w-full"
              variant="ghost"
            />
          }
        >
          {switcherContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="flex min-w-56 flex-col rounded-lg p-0 md:w-(--radix-dropdown-menu-trigger-width)"
          side="bottom"
          sideOffset={4}
        >
          {orgsCollection.length > 5 ? (
            <Input
              className="shrink-0"
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
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-onboarding-panel-foreground/20 text-onboarding-panel-foreground text-xs font-semibold">
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </div>
  );
}
