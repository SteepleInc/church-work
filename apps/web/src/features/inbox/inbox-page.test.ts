import { describe, expect, test } from "bun:test";

import { getBreadcrumbLabel, getPrimaryAppShellNavItems } from "@/components/app-shell-utils";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";

describe("Inbox navigation plumbing", () => {
  test("registers Inbox as a first-class app shell surface", async () => {
    const navSource = await Bun.file(
      new URL("../../components/navigation/app-navigation.tsx", import.meta.url),
    ).text();
    const routeTreeSource = await Bun.file(
      new URL("../../routeTree.gen.ts", import.meta.url),
    ).text();

    expect(getPrimaryAppShellNavItems()[0]).toEqual({
      label: "Inbox",
      matchPath: "/inbox",
      to: "/inbox",
    });
    expect(getBreadcrumbLabel("/inbox")).toBe("Inbox");
    expect(navSource).toContain("<InboxSidebarItem />");
    expect(routeTreeSource).toContain("/_org/inbox");
  });

  test("wires the sidebar badge to unread active-Church notifications", async () => {
    const sidebarSource = await Bun.file(
      new URL("../../components/navigation/inbox-sidebar-item.tsx", import.meta.url),
    ).text();
    const dataSource = await Bun.file(
      new URL("../../data/notifications/notificationsData.app.ts", import.meta.url),
    ).text();

    expect(sidebarSource).toContain("useCurrentOrgOpt");
    expect(sidebarSource).toContain("useNotificationsCollection");
    expect(sidebarSource).toContain("badge={unreadCount > 0 ? unreadCount : null}");
    expect(dataSource).toContain("queries.notifications.by_recipient");
    expect(dataSource).toContain("notification.read_at == null");
  });

  test("opens notifications into the task details pane and marks them read", async () => {
    const pageSource = await Bun.file(new URL("./inbox-page.tsx", import.meta.url)).text();
    const dataSource = await Bun.file(
      new URL("../../data/notifications/notificationsData.app.ts", import.meta.url),
    ).text();

    expect(pageSource).toContain("useOpenTaskDetailsPaneUrl");
    expect(pageSource).toContain("useMarkNotificationReadMutation");
    expect(pageSource).toContain(
      "const taskReference = getNotificationTaskReference(notification)",
    );
    expect(pageSource).toContain("openTaskDetailsPaneUrl({ id: taskReference })");
    expect(pageSource).toContain("markNotificationRead({");
    expect(dataSource).toContain("mutators.notifications.mark_read");
  });

  test("wires Inbox bulk and row action controls to Notification mutations", async () => {
    const pageSource = await Bun.file(new URL("./inbox-page.tsx", import.meta.url)).text();
    const dataSource = await Bun.file(
      new URL("../../data/notifications/notificationsData.app.ts", import.meta.url),
    ).text();

    expect(pageSource).toContain("Mark all read");
    expect(pageSource).toContain("Delete read");
    expect(pageSource).toContain("Mark notification unread");
    expect(pageSource).toContain("Delete notification");
    expect(dataSource).toContain("mutators.notifications.mark_unread");
    expect(dataSource).toContain("mutators.notifications.mark_all_read");
    expect(dataSource).toContain("mutators.notifications.delete(");
    expect(dataSource).toContain("mutators.notifications.delete_read");
  });

  test("keeps G then I global and guarded from editable targets", async () => {
    const appShellSource = await Bun.file(
      new URL("../../components/app-shell.tsx", import.meta.url),
    ).text();

    expect(appShellSource).toContain('createSequenceMatcher(["G", "I"]');
    expect(appShellSource).toContain('navigate({ to: "/inbox" })');
    expect(appShellSource).toContain("isEditableShortcutTarget(event.target)");
  });

  test("detects editable shortcut targets", () => {
    class FakeHTMLElement extends EventTarget {
      constructor(
        readonly tagName: string,
        readonly isContentEditable = false,
      ) {
        super();
      }
    }

    const originalHTMLElement = globalThis.HTMLElement;
    globalThis.HTMLElement = FakeHTMLElement as unknown as typeof HTMLElement;

    try {
      expect(isEditableShortcutTarget(null)).toBe(false);
      expect(isEditableShortcutTarget(new EventTarget())).toBe(false);
      expect(isEditableShortcutTarget(new FakeHTMLElement("INPUT"))).toBe(true);
      expect(isEditableShortcutTarget(new FakeHTMLElement("TEXTAREA"))).toBe(true);
      expect(isEditableShortcutTarget(new FakeHTMLElement("SELECT"))).toBe(true);
      expect(isEditableShortcutTarget(new FakeHTMLElement("DIV", true))).toBe(true);
      expect(isEditableShortcutTarget(new FakeHTMLElement("BUTTON"))).toBe(false);
    } finally {
      globalThis.HTMLElement = originalHTMLElement;
    }
  });
});
