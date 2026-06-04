import { describe, expect, test } from "bun:test";

const detailsPaneSource = await Bun.file(new URL("./details-pane.tsx", import.meta.url)).text();
const detailsPaneHistorySource = await Bun.file(
  new URL("./details-pane-history.tsx", import.meta.url),
).text();
const detailsShellSource = await Bun.file(new URL("./details-shell.tsx", import.meta.url)).text();
const toggleDetailsPaneButtonSource = await Bun.file(
  new URL("./toggle-details-pane-button.tsx", import.meta.url),
).text();
const detailsPaneHelpersSource = await Bun.file(
  new URL("./details-pane-helpers.ts", import.meta.url),
).text();

describe("details pane PreachX fidelity", () => {
  test("uses the copied PreachX responsive drawer/dialog/sticky shell", () => {
    expect(detailsPaneSource).toContain("function DetailsPaneWrapper");
    expect(detailsPaneSource).toContain("useIsMdScreen()");
    expect(detailsPaneSource).toContain("detailsPaneStickyAtom");
    expect(detailsPaneSource).toContain("<Drawer");
    expect(detailsPaneSource).toContain("<Dialog");
    expect(detailsPaneSource).toContain("<ToggleDetailsPaneButton />");
    expect(detailsPaneSource).toContain("<DetailsPaneHistory history={detailsPaneParams} />");
    expect(detailsPaneSource).not.toContain("<aside");
  });

  test("keeps copied PreachX history, toggle, shell slots, and ctrl-click behavior", () => {
    expect(detailsPaneHistorySource).toContain("export function DetailsPaneHistory");
    expect(detailsPaneHistorySource).toContain("<Breadcrumb");
    expect(detailsPaneHistorySource).toContain("Array.take(index + 1)");
    expect(detailsShellSource).toContain("<MainContainer>");
    expect(detailsShellSource).toContain("tabBar");
    expect(detailsShellSource).toContain("h-[55px]");
    expect(detailsShellSource).toContain("px-4");
    expect(toggleDetailsPaneButtonSource).toContain("detailsPaneStickyAtom");
    expect(toggleDetailsPaneButtonSource).toContain("Pin details pane");
    expect(toggleDetailsPaneButtonSource).toContain("Overlay details pane");
    expect(detailsPaneHelpersSource).toContain(
      "event.nativeEvent.ctrlKey || event.nativeEvent.metaKey",
    );
    expect(detailsPaneHelpersSource).toContain("event.preventDefault()");
  });
});
