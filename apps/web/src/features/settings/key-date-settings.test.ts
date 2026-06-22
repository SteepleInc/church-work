import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("Key Date settings inline name forms", () => {
  it("uses TanStack Form for submitted Key Date name values", () => {
    const source = readFileSync(new URL("./key-date-settings.tsx", import.meta.url), "utf8");

    expect(source).toContain("useAppForm");
    expect(source).toContain("const form = useAppForm");
    expect(source).toContain('<form.Field name="name">');
    expect(source).toContain("void form.handleSubmit()");
    expect(source).toContain("field.handleChange(next)");
    expect(source).toContain("field.handleBlur()");
    expect(source).not.toContain("const [internal, setInternal]");
  });
});
