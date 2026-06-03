import type { LucideIcon } from "lucide-react";

export type QuickActionGroup = "big-action" | "quick-action";

export type QuickActionDefinition = {
  readonly group: QuickActionGroup;
  readonly icon: LucideIcon;
  readonly name: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly shortcut?: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly onSelect: () => void | Promise<void>;
};
