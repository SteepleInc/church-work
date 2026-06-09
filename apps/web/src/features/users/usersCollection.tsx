import { Collection } from "@/components/collections/collection";
import { usersColumnsDef } from "@/data/users/usersCollectionDef";
import {
  useAllUsersCollectionWithFilters,
  type UserCollectionItem,
} from "@/data/users/usersData.app";
import { UserActions } from "@/features/actions/userActions";
import { FilterKeys } from "@/shared/global-state";

type UsersCollectionProps = {
  readonly _tag: "global";
};

export function UsersCollection(props: UsersCollectionProps) {
  const { _tag } = props;

  if (_tag === "global") {
    return <GlobalUsersCollection />;
  }

  return null;
}

function GlobalUsersCollection() {
  const { limit, loading, nextPage, pageSize, usersCollection } =
    useAllUsersCollectionWithFilters();

  return (
    <Collection<UserCollectionItem>
      _tag="users"
      columnPinning={{ left: ["name"] }}
      columnsDef={usersColumnsDef}
      data={usersCollection}
      filterColumnId="name"
      filterKey={FilterKeys.Users}
      filterPlaceHolder="Search users"
      limit={limit}
      loading={loading}
      nextPage={nextPage}
      pageSize={pageSize}
      rowActions={(user) => <UserActions mode="table" userId={user.id} />}
    />
  );
}
