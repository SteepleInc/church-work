import { describe, expect, test } from "bun:test";

import {
  getChangedDetailsPaneId,
  getDetailsPaneSearch,
  parseDetailsPaneState,
} from "@/components/details-pane/details-pane-helpers";

describe("details pane route search", () => {
  test("parses valid URL-driven details pane state", () => {
    expect(
      parseDetailsPaneState({
        "details-pane": [{ _tag: "task", id: "task-1", tab: "details" }],
      }),
    ).toEqual([{ _tag: "task", id: "task-1", tab: "details" }]);
  });

  test("round-trips org details pane history stacks", () => {
    const history = [
      { _tag: "org" as const, id: "org-1", tab: "details" as const },
      { _tag: "org" as const, id: "org-2", tab: "details" as const },
    ];

    expect(parseDetailsPaneState(getDetailsPaneSearch({}, history))).toEqual(history);
  });

  test("drops invalid details pane state", () => {
    expect(
      parseDetailsPaneState({
        "details-pane": [{ _tag: "video", id: "video-1", tab: "details" }],
      }),
    ).toEqual([]);
  });

  test("writes details pane state without discarding existing route search", () => {
    expect(
      getDetailsPaneSearch({ taskState: "todo" }, [{ _tag: "team", id: "team-1", tab: "details" }]),
    ).toEqual({
      taskState: "todo",
      "details-pane": [{ _tag: "team", id: "team-1", tab: "details" }],
    });
  });

  test("clears details pane state by removing the search value", () => {
    expect(getDetailsPaneSearch({ taskState: "todo" }, [])).toEqual({
      taskState: "todo",
      "details-pane": undefined,
    });
  });

  test("changes the current details pane entity id", () => {
    expect(
      getChangedDetailsPaneId(
        [
          { _tag: "org", id: "org-1", tab: "details" },
          { _tag: "task", id: "task-1", tab: "details" },
        ],
        "task-2",
      ),
    ).toEqual([
      { _tag: "org", id: "org-1", tab: "details" },
      { _tag: "task", id: "task-2", tab: "details" },
    ]);
  });
});
