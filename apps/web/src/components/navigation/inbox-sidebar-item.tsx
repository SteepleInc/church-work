import { InboxIcon } from "lucide-react";

import { SideBarItem } from "@/components/navigation/sidebar-item";
import { useNotificationsCollection } from "@/data/notifications/notificationsData.app";
import { useCurrentOrgOpt } from "@/data/orgs/orgData.app";

export function InboxSidebarItem() {
  const { currentOrgOpt } = useCurrentOrgOpt();
  const { unreadCount } = useNotificationsCollection({ churchId: currentOrgOpt?.id ?? null });

  return (
    <SideBarItem
      badge={unreadCount > 0 ? unreadCount : null}
      icon={<InboxIcon className="size-4" />}
      title="Inbox"
      to="/inbox"
    />
  );
}
