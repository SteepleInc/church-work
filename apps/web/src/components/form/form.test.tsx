import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "@/components/ui/button";

import { Form, getSubmitButtonText, type FormStateWithErrorMap } from "./form";

describe("copied form primitives", () => {
  test("derives submit button labels", () => {
    expect(getSubmitButtonText({ _tag: "create" })).toBe("Create");
    expect(getSubmitButtonText({ _tag: "edit" })).toBe("Update");
    expect(getSubmitButtonText({ _tag: "edit", clone: true })).toBe("Clone");
  });

  test("renders public form submit errors", () => {
    const fakeForm = {
      handleSubmit: () => undefined,
      Subscribe: <TSelected,>({
        selector,
        children,
      }: {
        selector: (state: FormStateWithErrorMap) => TSelected;
        children: ((state: TSelected) => ReactNode) | ReactNode;
      }) => {
        const selected = selector({ errorMap: { onSubmit: { form: "Try again" } } });
        return typeof children === "function" ? children(selected) : children;
      },
    };

    const html = renderToStaticMarkup(<Form form={fakeForm}>Body</Form>);

    expect(html).toContain("Try again");
    expect(html).toContain("Body");
    expect(html).toContain("border-red-200");
    expect(html).toContain("text-red-700");
  });

  test("button loading state overlays content", () => {
    const html = renderToStaticMarkup(<Button loading>Save</Button>);

    expect(html).toContain('data-loading="true"');
    expect(html).toContain("group-data-[loading=true]/button:opacity-30");
    expect(html).toContain("Save");
  });
});
