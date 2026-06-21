import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createSequenceMatcher } from "@tanstack/hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CheckCircleIcon } from "@/components/icons/checkCircleIcon";
import { ChevronDownIcon } from "@/components/icons/chevronDownIcon";
import { PlusIcon } from "@/components/icons/plusIcon";
import { getFilteredOrgSwitcherItems } from "@/components/org-switcher-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemWithLoading,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangeOrg } from "@/data/useChangeOrg";
import { useCreateOrg } from "@/data/useCreateOrg";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";
import { type OrgCollectionItem, useUserOrgsCollection } from "@/data/orgs/orgsData.app";
import { useOrgId } from "@/data/useOrgId";
import { clearIntentionalSignOut, markIntentionalSignOut } from "@/features/auth/sign-out-routing";
import { authClient } from "@/lib/auth-client";

// Avoid hijacking shortcuts while the user is typing in a field.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function OrgSwitcher() {
  const navigate = useNavigate();
  const { currentOrgOpt, loading: currentOrgLoading } = useCurrentOrgOpt();
  const { orgsCollection } = useUserOrgsCollection();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const { createOrg } = useCreateOrg();
  const { setOpenMobile } = useSidebar();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const filteredOrgs = getFilteredOrgSwitcherItems({ orgs: orgsCollection, search });

  const goToSettings = () => {
    setOpenMobile(false);
    void navigate({ to: "/settings/account/profile" });
  };

  const signOut = async () => {
    markIntentionalSignOut();
    setIsSigningOut(true);

    await authClient.signOut();
    await navigate({ to: "/" });
    clearIntentionalSignOut();

    setIsSigningOut(false);
  };

  // Linear-style sequence shortcuts: "G then S" opens Settings, "O then W"
  // opens the Switch workspace submenu. Skipped while typing in a field.
  useEffect(() => {
    const settingsMatcher = createSequenceMatcher(["G", "S"], { timeout: 1000 });
    const switchMatcher = createSequenceMatcher(["O", "W"], { timeout: 1000 });

    const handler = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (settingsMatcher.match(event)) {
        event.preventDefault();
        setOpen(false);
        goToSettings();
        return;
      }

      if (switchMatcher.match(event)) {
        event.preventDefault();
        setOpen(true);
        setSwitchOpen(true);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Linear-style "Option+Shift+Q" logs out from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }
      if (!(event.altKey && event.shiftKey)) {
        return;
      }
      if (event.key.toLowerCase() !== "q") {
        return;
      }
      event.preventDefault();
      void signOut();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (currentOrgLoading && !currentOrgOpt) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="pointer-events-none cursor-default">
            <Skeleton className="size-6 shrink-0 rounded-md bg-muted-foreground/20" />
            <Skeleton className="h-3 w-24 flex-1 bg-muted-foreground/20" />
            <ChevronDownIcon className="ml-auto size-4 text-muted-foreground/40" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={setOpen} open={open}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" />
            }
          >
            <ChurchAvatar name={currentOrgOpt?.name ?? "No Name"} />
            <span className="flex-1 truncate text-left font-semibold">
              {currentOrgOpt?.name ?? "No Name"}
            </span>
            <ChevronDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 rounded-lg"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={goToSettings}>
              <HugeiconsIcon className="size-4" icon={Settings01Icon} strokeWidth={2} />
              <span>Settings</span>
              <DropdownMenuShortcut>
                <Kbd>G</Kbd>
                <span className="mx-1">then</span>
                <Kbd>S</Kbd>
              </DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub onOpenChange={setSwitchOpen} open={switchOpen}>
              <DropdownMenuSubTrigger>
                <span>Switch Church</span>
                <DropdownMenuShortcut className="mr-2">
                  <Kbd>O</Kbd>
                  <span className="mx-1">then</span>
                  <Kbd>W</Kbd>
                </DropdownMenuShortcut>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="flex max-h-80 w-64 flex-col p-0">
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
                    {filteredOrgs.map((org) => (
                      <OrgDropdownItem key={org.id} org={org} />
                    ))}

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Account
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={createOrg}>
                      <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                        <PlusIcon className="size-4" />
                      </div>
                      <div className="font-medium text-muted-foreground">Create Church</div>
                    </DropdownMenuItem>
                  </ScrollArea>
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItemWithLoading loading={isSigningOut} onClick={signOut}>
              <LogOutIcon className="size-4" />
              <span>Log out</span>
              <DropdownMenuShortcut>
                <Kbd>alt shift Q</Kbd>
              </DropdownMenuShortcut>
            </DropdownMenuItemWithLoading>
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
          ? "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold"
          : "flex size-6 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-semibold"
      }
    >
      {name.slice(0, 1).toLocaleUpperCase() || "C"}
    </div>
  );
}
