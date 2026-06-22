import { describe, expect, test } from "bun:test";

describe("template authoring inline Key Date creator", () => {
  test("keeps submitted name and schedule in the TanStack Form stack", async () => {
    const source = await Bun.file(new URL("./template-authoring.tsx", import.meta.url)).text();
    const inlineCreatorSource = source.slice(
      source.indexOf("function InlineKeyDateCreator"),
      source.indexOf("// --- Key Date: Step 3"),
    );

    expect(inlineCreatorSource).toContain("const form = useAppForm");
    expect(inlineCreatorSource).toContain('name: ""');
    expect(inlineCreatorSource).toContain("schedule: defaultScheduleForKind");
    expect(inlineCreatorSource).toContain('form.Field name="name"');
    expect(inlineCreatorSource).toContain('form.setFieldValue("schedule"');
    expect(inlineCreatorSource).toContain("value.name.trim()");
    expect(inlineCreatorSource).not.toContain("useState");
  });
});
