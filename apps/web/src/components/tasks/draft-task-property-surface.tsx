import { CalendarDays, SignalHigh, Tag, Triangle, User, Users, Workflow } from "lucide-react";
import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { cn } from "@/lib/utils";

import { isEditableTarget } from "./task-kanban-board-utils";
import { resolveTaskFieldShortcut, type TaskShortcutField } from "./task-surface-keyboard-utils";

export type DraftTaskPickerRefs = Partial<
  Record<TaskShortcutField, MutableRefObject<(() => void) | null>>
>;

// "Armed" hover affordance for card-shaped create surfaces. These cards already
// carry a resting `border`, so — unlike Board cards, which use a persistent
// `ring-1 ring-foreground/10` as their outline — we keep the ring hidden at rest
// and pop a faint `ring-1` on hover. That avoids a heavy double-outline (border
// + ring) while still signalling the same keyboard-armed state Board cards show.
const ARMED_RING = "ring-foreground/10 transition-colors hover:ring-1 hover:ring-foreground/20";

const FIELD_ITEMS: readonly {
  readonly field: TaskShortcutField;
  readonly label: string;
  readonly shortcut: string;
  readonly icon: ReactNode;
}[] = [
  { field: "status", label: "Status", shortcut: "S", icon: <Workflow /> },
  { field: "assignee", label: "Assignee", shortcut: "A", icon: <User /> },
  // SignalHigh mirrors the Priority field's signal-bar identity (Triangle is the
  // Estimate glyph), so the two property rows never share an icon.
  { field: "priority", label: "Priority", shortcut: "P", icon: <SignalHigh /> },
  { field: "estimate", label: "Estimate", shortcut: "⇧E", icon: <Triangle /> },
  { field: "labels", label: "Labels", shortcut: "L", icon: <Tag /> },
  { field: "dueDate", label: "Due date", shortcut: "D", icon: <CalendarDays /> },
  { field: "team", label: "Team", shortcut: "T", icon: <Users /> },
];

function openPicker(ref: MutableRefObject<(() => void) | null> | undefined) {
  requestAnimationFrame(() => ref?.current?.());
}

export function DraftTaskPropertySurface({
  children,
  pickerRefs,
  className = "relative",
  /**
   * Show the shared armed hover-ring on the surface itself. Card-shaped create
   * surfaces (inline sub-task creator, Template Task card) opt in so they echo
   * the Board card / sub-task row affordance; the dialog-body create-task
   * surface leaves it off because the dialog already frames the content.
   */
  showArmedRing = false,
}: {
  readonly children: ReactNode;
  readonly pickerRefs: DraftTaskPickerRefs;
  readonly className?: string;
  readonly showArmedRing?: boolean;
}) {
  const armedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!armedRef.current) return;
      if (isEditableTarget(event.target)) return;
      const intent = resolveTaskFieldShortcut(event);
      if (intent.kind !== "field") return;
      const opener = pickerRefs[intent.field]?.current;
      if (!opener) return;
      event.preventDefault();
      opener();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pickerRefs]);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        onContextMenu={(event) => event.stopPropagation()}
        onPointerEnter={() => {
          armedRef.current = true;
        }}
        // Disarm when the pointer leaves so the hover-armed keys only fire while
        // the surface is actually hovered (matches the per-row arming on the
        // view surfaces and avoids a stale-armed surface stealing keystrokes).
        onPointerLeave={() => {
          armedRef.current = false;
        }}
        render={
          <div
            className={cn(className, showArmedRing && ARMED_RING)}
            data-task-draft-property-surface="true"
          />
        }
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          {FIELD_ITEMS.map((item) =>
            pickerRefs[item.field] ? (
              <ContextMenuItem key={item.field} onClick={() => openPicker(pickerRefs[item.field])}>
                {item.icon}
                {item.label}
                <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null,
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
