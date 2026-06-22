import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("Key Date settings inline name forms", () => {
  it("uses TanStack Form for submitted Key Date name values", () => {
    const settingsSource = readFileSync(
      new URL("./key-date-settings.tsx", import.meta.url),
      "utf8",
    );
    const inputSource = readFileSync(
      new URL("./inline-name-form-input.tsx", import.meta.url),
      "utf8",
    );

    expect(settingsSource).toContain("InlineNameFormInput");
    expect(inputSource).toContain("useAppForm");
    expect(inputSource).toContain("const form = useAppForm");
    expect(inputSource).toContain('<form.Field name="name">');
    expect(inputSource).toContain("void form.handleSubmit()");
    expect(inputSource).toContain("field.handleChange(next)");
    expect(inputSource).toContain("field.handleBlur()");
    expect(inputSource).not.toContain("const [internal, setInternal]");
  });
});
