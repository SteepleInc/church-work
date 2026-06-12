import { describe, expect, test } from "bun:test";

import { getUserDisplayName } from "./usersData.app";

describe("getUserDisplayName", () => {
  test("falls back to email when the user's name is blank", () => {
    expect(getUserDisplayName({ id: "user-1", name: " ", email: "ada@example.com" })).toBe(
      "ada@example.com",
    );
  });

  test("falls back to id when name and email are blank", () => {
    expect(getUserDisplayName({ id: "user-1", name: "", email: " " })).toBe("user-1");
  });
});
