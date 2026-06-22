import { describe, expect, test } from "bun:test";

import {
  buildSubTaskCreateInput,
  initialFormValues,
  type SubTaskCreatorDefaults,
} from "./sub-task-creator";

const defaults: SubTaskCreatorDefaults = {
  assignedUserId: "user-1",
  teamId: "team-1",
  priority: "medium",
};

describe("sub-task creator form values", () => {
  test("initializes from inherited defaults", () => {
    expect(initialFormValues(defaults)).toEqual({
      title: "",
      description: "",
      assignedUserId: "user-1",
      teamId: "team-1",
      priority: "medium",
      estimate: "no_estimate",
      labelIds: [],
      dueDate: null,
    });
  });

  test("builds create input while trimming optional description", () => {
    expect(
      buildSubTaskCreateInput(
        {
          ...initialFormValues(defaults),
          description: "  prep slides  ",
          estimate: "s",
          labelIds: ["label-1"],
          dueDate: "2026-06-22",
        },
        "Follow up",
      ),
    ).toEqual({
      title: "Follow up",
      description: "prep slides",
      assignedUserId: "user-1",
      teamId: "team-1",
      priority: "medium",
      estimate: "s",
      labelIds: ["label-1"],
      dueDate: "2026-06-22",
    });
  });

  test("normalizes blank descriptions to null", () => {
    expect(buildSubTaskCreateInput(initialFormValues(defaults), "Follow up").description).toBe(
      null,
    );
  });
});
