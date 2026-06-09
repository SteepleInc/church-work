import { describe, expect, test } from "bun:test";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UserLink } from "@/components/navigation/links";
import { createUsersFiltersDef, usersColumnsDef } from "@/data/users/usersCollectionDef";
import type { UserCollectionItem } from "@/data/users/usersData.app";

const representativeUser = {
  id: "user_123",
  name: "Ada Lovelace",
  email: "ada@example.com",
  image: null,
  createdAt: Date.UTC(2026, 0, 2),
  churches: [{ id: "org_123", name: "Grace Church", role: "owner", slug: "grace" }],
} satisfies UserCollectionItem;

function getCell(columnId: string, user: UserCollectionItem = representativeUser) {
  const column = usersColumnsDef.find((candidate) => candidate.id === columnId);

  if (!column || typeof column.cell !== "function") {
    throw new Error(`Missing cell renderer for ${columnId}`);
  }

  return column.cell({ row: { original: user } } as never);
}

function renderCell(columnId: string, user: UserCollectionItem = representativeUser) {
  return renderToStaticMarkup(getCell(columnId, user));
}

function findElementOfType(node: unknown, type: unknown): Record<string, unknown> | null {
  if (!isValidElement(node)) {
    return null;
  }

  const element = node as { type: unknown; props: Record<string, unknown> };

  if (element.type === type) {
    return element.props;
  }

  const children = element.props.children;
  const childArray = Array.isArray(children) ? children : [children];

  for (const child of childArray) {
    const found = findElementOfType(child, type);

    if (found) {
      return found;
    }
  }

  return null;
}

describe("users collection columns", () => {
  test("defines the admin users column set in order", () => {
    expect(usersColumnsDef.map((column) => column.id)).toEqual([
      "name",
      "email",
      "churches",
      "createdAt",
    ]);
  });

  test("name cell opens the user details pane via UserLink", () => {
    const props = findElementOfType(getCell("name"), UserLink);

    expect(props).not.toBeNull();
    expect(props?.user).toEqual({ id: "user_123", name: "Ada Lovelace" });
  });

  test("renders representative email, churches, and created cells", () => {
    expect(renderCell("email")).toContain("ada@example.com");
    expect(renderCell("churches")).toContain("Grace Church");
    expect(renderCell("createdAt")).toContain("Jan 2, 2026");
  });

  test("builds name/email/churches filters", () => {
    const filters = createUsersFiltersDef([{ label: "Grace Church", value: "org_123" }]);

    expect(filters.map((filter) => filter.id)).toEqual(["name", "email", "churches"]);
    expect(filters.find((filter) => filter.id === "churches")?.options).toEqual([
      { label: "Grace Church", value: "org_123" },
    ]);
  });
});
