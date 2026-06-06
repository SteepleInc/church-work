import { Collection } from "@/components/collections/collection";
import { orgsColumnsDef, orgsFiltersDef } from "@/data/orgs/orgsCollectionDef";
import { useAllOrgsCollectionWithFilters, type OrgCollectionItem } from "@/data/orgs/orgsData.app";

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
  const { canLoadMore, limit, loading, loadingMore, nextPage, orgsCollection, pageSize } =
    useAllOrgsCollectionWithFilters();

  return (
    <Collection<OrgCollectionItem>
      _tag="orgs"
      canLoadMore={canLoadMore}
      columnPinning={{ left: ["name"] }}
      columnsDef={orgsColumnsDef}
      data={orgsCollection}
      filterColumnId="name"
      filterKey="orgs"
      filterPlaceHolder="Search organizations"
      filtersDef={orgsFiltersDef}
      limit={limit}
      loading={loading}
      loadingMore={loadingMore}
      nextPage={nextPage}
      pageSize={pageSize}
    />
  );
}
