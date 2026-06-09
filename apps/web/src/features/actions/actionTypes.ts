import type { ReactNode } from "react";

export type EntityAction = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly onAction: () => void;
  readonly loading?: boolean;
  readonly destructive?: boolean;
  readonly primary?: boolean;
  readonly disabled?: boolean;
};

export type EntityActionsRenderMode = "table" | "card" | "details-pane" | "page-header";

export type EntityActionsMenuProps = {
  readonly actions: ReadonlyArray<EntityAction>;
  readonly className?: string;
  readonly mode: EntityActionsRenderMode;
  readonly onClose?: () => void;
};
