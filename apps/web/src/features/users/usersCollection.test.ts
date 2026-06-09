import { describe, expect, test } from "bun:test";

const usersCollectionSource = await Bun.file(
  new URL("./usersCollection.tsx", import.meta.url),
).text();
const usersColumnsSource = await Bun.file(
  new URL("../../data/users/usersCollectionDef.tsx", import.meta.url),
).text();

describe("users collection details-pane wiring", () => {
  test("clicking a user name opens the user details pane via UserLink", () => {
    expect(usersColumnsSource).toContain(
      'import { UserLink } from "@/components/navigation/links"',
    );
    expect(usersColumnsSource).toContain("<UserLink");
  });

  test("renders App Administrator row actions for each user", () => {
    expect(usersCollectionSource).toContain(
      'import { UserActions } from "@/features/actions/userActions"',
    );
    expect(usersCollectionSource).toContain(
      'rowActions={(user) => <UserActions mode="table" userId={user.id} />}',
    );
  });
});
