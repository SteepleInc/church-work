import { BaseAvatar } from "@/components/avatars/baseAvatar";
import { DetailItem, DetailSection } from "@/components/details-pane/details-components";
import { DetailsShell } from "@/components/details-pane/details-shell";
import type { DetailsPaneUser } from "@/components/details-pane/details-pane-types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCreatedAt } from "@/data/orgs/orgsCollectionDef";
import { useUserData } from "@/data/users/userData.app";
import type { UserCollectionItem } from "@/data/users/usersData.app";
import { UserActions } from "@/features/actions/userActions";

export function UserDetailsPane({
  tab,
  userId,
}: {
  readonly tab: DetailsPaneUser["tab"];
  readonly userId: string;
}) {
  const { loading, userOpt: user } = useUserData({ userId });

  return (
    <DetailsShell
      topBarButtons={<UserTopBarButtons userId={userId} />}
      header={
        <div className="flex flex-row items-center gap-3">
          <BaseAvatar avatar={user?.image} name={user?.name ?? "User"} size={48} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="line-clamp-2 font-semibold text-lg leading-6">{user?.name || "User"}</h2>
            <p className="text-muted-foreground text-sm">
              {loading ? "Loading..." : (user?.email ?? userId)}
            </p>
          </div>
        </div>
      }
      tabBar={<UserDetailsTabBar activeTab={tab} />}
      content={
        user ? (
          <UserDetailsContent user={user} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading User details..." : "User details are unavailable."}
          </p>
        )
      }
    />
  );
}

function UserTopBarButtons({ userId }: { readonly userId: string }) {
  return (
    <div className="flex items-center gap-2">
      <UserActions userId={userId} mode="details-pane" />
      <span className="sr-only">Details for User {userId}</span>
    </div>
  );
}

function UserDetailsTabBar({ activeTab }: { readonly activeTab: DetailsPaneUser["tab"] }) {
  return (
    <Tabs className="relative z-10 flex flex-1 flex-row" value={activeTab}>
      <TabsList className="flex-1 justify-start">
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function UserDetailsContent({ user }: { readonly user: UserCollectionItem }) {
  return (
    <>
      <DetailSection title="Overview">
        <DetailItem label="Name" value={user.name || "Not set"} />
        <DetailItem label="Email" value={user.email ?? "No email"} />
      </DetailSection>

      <DetailSection title="Churches">
        <DetailItem
          label="Church Memberships"
          value={
            user.churches.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.churches.map((church) => (
                  <Badge key={church.id} variant="outline">
                    {church.name} ({church.role})
                  </Badge>
                ))}
              </div>
            ) : (
              "No Church memberships"
            )
          }
        />
      </DetailSection>

      <DetailSection title="Created">
        <DetailItem label="Created At" value={formatCreatedAt(user.createdAt)} />
      </DetailSection>
    </>
  );
}
