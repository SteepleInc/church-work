import { describe, expect, test } from "bun:test";

import { getTeamChildHref, resolveActiveTeamChild, teamNavChildren } from "./team-nav";

describe("team navigation", () => {
  test("exposes Team Weeks with Current and Upcoming shortcuts", () => {
    expect(teamNavChildren.map((child) => child.label)).toEqual(["Tasks", "Weeks"]);

    const weeks = teamNavChildren.find((child) => child.key === "weeks");
    expect(weeks?.children?.map((child) => child.label)).toEqual(["Current", "Upcoming"]);
    expect(JSON.stringify(teamNavChildren)).not.toMatch(/cycle/i);
  });

  test("builds Team Tasks and Week shortcut destinations", () => {
    expect(getTeamChildHref("care", "tasks")).toBe("/team/care");
    expect(getTeamChildHref("care", "weeks")).toBe("/team/care/weeks");
    expect(getTeamChildHref("care", "current")).toBe("/team/care?week=current");
    expect(getTeamChildHref("care", "upcoming")).toBe("/team/care?week=upcoming");
  });

  test("lights up the active Team sub-item from the URL", () => {
    const teamHref = "/team/care";

    // The bare Team path is the Default Team View ("Tasks").
    expect(resolveActiveTeamChild({ pathname: teamHref, teamHref, week: undefined })).toBe("tasks");
    expect(
      resolveActiveTeamChild({ pathname: `${teamHref}/weeks`, teamHref, week: undefined }),
    ).toBe("weeks");
    expect(
      resolveActiveTeamChild({ pathname: `${teamHref}/weeks/cycle-1`, teamHref, week: undefined }),
    ).toBe("weeks");

    // The Week shortcuts share the Team path, scoped by the `week` param.
    expect(resolveActiveTeamChild({ pathname: teamHref, teamHref, week: "current" })).toBe(
      "current",
    );
    expect(resolveActiveTeamChild({ pathname: teamHref, teamHref, week: "upcoming" })).toBe(
      "upcoming",
    );

    // Nested Team routes still resolve to the Team, not a sibling Team.
    expect(
      resolveActiveTeamChild({ pathname: `${teamHref}/PRD-1`, teamHref, week: undefined }),
    ).toBe("tasks");

    // A different Team's path lights nothing here.
    expect(
      resolveActiveTeamChild({ pathname: "/team/kids", teamHref, week: "current" }),
    ).toBeNull();
    // A prefix collision (/team/care-team) is not this Team.
    expect(
      resolveActiveTeamChild({ pathname: "/team/care-team", teamHref, week: undefined }),
    ).toBeNull();
  });
});
