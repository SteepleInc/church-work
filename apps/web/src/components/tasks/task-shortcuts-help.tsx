import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

/**
 * Linear-style keyboard shortcuts reference (opened with Cmd/Ctrl + /). Lists
 * the Task surface shortcuts grouped by purpose. Keep this in sync with the
 * bindings in {@link file://./task-surface-keyboard.tsx} and the global
 * shortcuts (Create Task `C`, Quick Actions `Cmd+K`, Search `/`).
 */

type Shortcut = {
  readonly label: string;
  // Each inner array is a chord rendered as adjacent keys.
  readonly keys: readonly string[];
};

type ShortcutSection = {
  readonly title: string;
  readonly shortcuts: readonly Shortcut[];
};

const SHORTCUT_SECTIONS: readonly ShortcutSection[] = [
  {
    title: "General",
    shortcuts: [
      { label: "Open command menu", keys: ["⌘", "K"] },
      { label: "Open search", keys: ["/"] },
      { label: "View keyboard shortcuts", keys: ["⌘", "/"] },
      { label: "Create Task", keys: ["C"] },
      { label: "Toggle sidebar", keys: ["["] },
      { label: "Clear selection / close", keys: ["Esc"] },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { label: "Move down", keys: ["J"] },
      { label: "Move up", keys: ["K"] },
      { label: "Move down / up", keys: ["↓", "↑"] },
      { label: "Open highlighted Task", keys: ["Enter"] },
      { label: "Open highlighted Task", keys: ["O"] },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { label: "Select highlighted Task", keys: ["X"] },
      { label: "Extend selection", keys: ["⇧", "↑"] },
      { label: "Extend selection", keys: ["⇧", "↓"] },
      { label: "Select all", keys: ["⌘", "A"] },
      { label: "Move Task up / down (board)", keys: ["⌥", "⇧", "↑"] },
    ],
  },
  {
    title: "Task properties",
    shortcuts: [
      { label: "Change status", keys: ["S"] },
      { label: "Assign", keys: ["A"] },
      { label: "Set priority", keys: ["P"] },
      { label: "Add labels", keys: ["L"] },
      { label: "Set estimate", keys: ["⇧", "E"] },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { label: "Toggle board / list layout", keys: ["⌘", "B"] },
      { label: "Open display options", keys: ["⇧", "V"] },
      { label: "Open filters", keys: ["F"] },
    ],
  },
];

export function TaskShortcutsHelp({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and act on Tasks without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {SHORTCUT_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {section.title}
              </h3>
              <ul className="grid gap-0.5">
                {section.shortcuts.map((shortcut) => (
                  <li
                    className="flex items-center justify-between gap-4 rounded-sm px-1 py-1 text-sm"
                    key={`${shortcut.label}-${shortcut.keys.join("+")}`}
                  >
                    <span>{shortcut.label}</span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
