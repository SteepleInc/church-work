import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("Team settings forms", () => {
  it("uses TanStack Form for submitted Team settings values", () => {
    const source = readFileSync(new URL("./team-settings.tsx", import.meta.url), "utf8");

    expect(source).toContain("useAppForm");
    expect(source).toContain("nameForm = useAppForm");
    expect(source).toContain("identifierForm = useAppForm");
    expect(source).toContain("addMemberForm = useAppForm");
    expect(source).toContain("field.handleChange(event.currentTarget.value.toUpperCase())");
    expect(source).not.toContain("const [name, setName]");
    expect(source).not.toContain("const [identifier, setIdentifierValue]");
    expect(source).not.toContain("const [selectedUserId, setSelectedUserId]");
  });
});
