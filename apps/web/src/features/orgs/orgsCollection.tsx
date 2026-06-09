import { Collection } from "@/components/collections/collection";
import { orgsColumnsDef } from "@/data/orgs/orgsCollectionDef";
import { useAllOrgsCollectionWithFilters, type OrgCollectionItem } from "@/data/orgs/orgsData.app";
import { OrgActions } from "@/features/actions/orgActions";
import { FilterKeys } from "@/shared/global-state";

type OrgsCollectionProps = {
  readonly _tag: "global";
};

export function OrgsCollection(props: OrgsCollectionProps) {
  const { _tag } = props;

  if (_tag === "global") {
    return <GlobalOrgsCollection />;
  }

  return null;
}

function GlobalOrgsCollection() {
  const { limit, loading, nextPage, orgsCollection, pageSize } = useAllOrgsCollectionWithFilters();

  return (
    <Collection<OrgCollectionItem>
      _tag="orgs"
      columnPinning={{ left: ["name"] }}
      columnsDef={orgsColumnsDef}
      data={orgsCollection}
      filterColumnId="name"
      filterKey={FilterKeys.Orgs}
      filterPlaceHolder="Search organizations"
      limit={limit}
      loading={loading}
      nextPage={nextPage}
      pageSize={pageSize}
      rowActions={(org) => <OrgActions mode="table" orgId={org.id} />}
    />
  );
}
