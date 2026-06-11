import { describe, expect, test } from "bun:test";

const dropdownMenuSource = await Bun.file(new URL("./dropdown-menu.tsx", import.meta.url)).text();

describe("DropdownMenuItemWithLoading", () => {
  test("keeps the copied PreachX loading treatment", () => {
    expect(dropdownMenuSource).toContain("function DropdownMenuItemWithLoading");
    expect(dropdownMenuSource).toContain("data-loading={loading}");
    expect(dropdownMenuSource).toContain("closeOnClick={false}");
    expect(dropdownMenuSource).toContain("disabled={loading}");
    expect(dropdownMenuSource).toContain("event.preventDefault();");
    expect(dropdownMenuSource).toContain("absolute inset-0 flex items-center justify-center opacity-0");
    expect(dropdownMenuSource).toContain("group-data-[loading=true]:opacity-30");
    expect(dropdownMenuSource).toContain("contentWrapperClassName");
  });
});
