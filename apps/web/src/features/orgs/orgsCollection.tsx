import { Collection } from "@/components/collections/collection";
import { useDetailsPaneState } from "@/components/details-pane/details-pane-helpers";
import { orgsColumnsDef, orgsFiltersDef } from "@/data/orgs/orgsCollectionDef";
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
  const { canLoadMore, limit, loading, loadingMore, nextPage, orgsCollection, pageSize } =
    useAllOrgsCollectionWithFilters();
  const [detailsPaneState, setDetailsPaneState] = useDetailsPaneState();

  return (
    <Collection<OrgCollectionItem>
      _tag="orgs"
      canLoadMore={canLoadMore}
      columnPinning={{ left: ["name"] }}
      columnsDef={orgsColumnsDef}
      data={orgsCollection}
      filterColumnId="name"
      filterKey={FilterKeys.Orgs}
      filterPlaceHolder="Search organizations"
      filtersDef={orgsFiltersDef}
      limit={limit}
      loading={loading}
      loadingMore={loadingMore}
      nextPage={nextPage}
      onRowClick={(org) => {
        const nextEntry = { _tag: "org" as const, id: org.id, tab: "details" as const };
        const currentEntry = detailsPaneState.at(-1);

        if (currentEntry?._tag === "org" && currentEntry.id === org.id) {
          return;
        }

        setDetailsPaneState([...detailsPaneState, nextEntry]);
      }}
      pageSize={pageSize}
      rowActions={(org) => <OrgActions orgId={org.id} mode="table" />}
    />
  );
}
