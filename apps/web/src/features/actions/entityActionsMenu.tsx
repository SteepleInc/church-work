import { MoreVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  EntityAction,
  EntityActionsMenuProps,
  EntityActionsRenderMode,
} from "@/features/actions/actionTypes";
import { cn } from "@/lib/utils";

function getTriggerProps(mode: EntityActionsRenderMode) {
  switch (mode) {
    case "details-pane":
      return { size: "icon-sm" as const, variant: "outline" as const };
    case "page-header":
      return { size: "icon" as const, variant: "secondary" as const };
    case "card":
    case "table":
      return { size: "icon-sm" as const, variant: "ghost" as const };
  }
}

function PrimaryActionButton({
  action,
  mode,
}: {
  readonly action: EntityAction;
  readonly mode: EntityActionsRenderMode;
}) {
  if (mode === "details-pane") {
    return (
      <Button
        disabled={action.disabled}
        loading={action.loading}
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          action.onAction();
        }}
        size="sm"
        type="button"
        variant={action.destructive ? "destructive" : "outline"}
      >
        {action.icon}
        {action.label}
      </Button>
    );
  }

  const triggerProps = getTriggerProps(mode);

  return (
    <Button
      disabled={action.disabled}
      loading={action.loading}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        action.onAction();
      }}
      size={triggerProps.size}
      type="button"
      variant={triggerProps.variant}
    >
      {action.icon}
    </Button>
  );
}

function ActionMenuItem({
  action,
  onClose,
}: {
  readonly action: EntityAction;
  readonly onClose?: () => void;
}) {
  return (
    <DropdownMenuItem
      className={cn(action.destructive && "text-destructive focus:text-destructive")}
      disabled={action.disabled || action.loading}
      onClick={() => {
        onClose?.();
        action.onAction();
      }}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  );
}

export function EntityActionsMenu({ actions, className, mode, onClose }: EntityActionsMenuProps) {
  const primaryActions = actions.filter((action) => action.primary === true);
  const secondaryActions = actions.filter((action) => action.primary !== true);
  const destructiveActions = secondaryActions.filter((action) => action.destructive === true);
  const normalActions = secondaryActions.filter((action) => action.destructive !== true);
  const showPrimaryOutside = mode === "card" || mode === "details-pane";
  const triggerProps = getTriggerProps(mode);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showPrimaryOutside
        ? primaryActions.map((action) => (
            <PrimaryActionButton action={action} key={action.id} mode={mode} />
          ))
        : null}
      {secondaryActions.length > 0 || (!showPrimaryOutside && primaryActions.length > 0) ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Open actions menu"
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                }}
                size={triggerProps.size}
                type="button"
                variant={triggerProps.variant}
              />
            }
          >
            <MoreVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            {!showPrimaryOutside
              ? primaryActions.map((action) => (
                  <ActionMenuItem action={action} key={action.id} onClose={onClose} />
                ))
              : null}
            {normalActions.map((action) => (
              <ActionMenuItem action={action} key={action.id} onClose={onClose} />
            ))}
            {normalActions.length > 0 && destructiveActions.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            {destructiveActions.map((action) => (
              <ActionMenuItem action={action} key={action.id} onClose={onClose} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function ActionsAsMenuItems({
  actions,
  onClose,
}: {
  readonly actions: ReadonlyArray<EntityAction>;
  readonly onClose?: () => void;
}): ReactNode {
  const destructiveActions = actions.filter((action) => action.destructive === true);
  const normalActions = actions.filter((action) => action.destructive !== true);

  return (
    <>
      {normalActions.map((action) => (
        <ActionMenuItem action={action} key={action.id} onClose={onClose} />
      ))}
      {normalActions.length > 0 && destructiveActions.length > 0 ? <DropdownMenuSeparator /> : null}
      {destructiveActions.map((action) => (
        <ActionMenuItem action={action} key={action.id} onClose={onClose} />
      ))}
    </>
  );
}
