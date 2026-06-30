import { FileTextIcon } from "lucide-react";

import { SideBarItem } from "@/components/navigation/sidebar-item";
import { useMyDraftsCollection } from "@/data/drafts/draftsData.app";

export function DraftsSidebarItem() {
  const { collection } = useMyDraftsCollection();
  if (collection.length === 0) return null;

  return (
    <SideBarItem
      badge={collection.length}
      icon={<FileTextIcon className="size-4" />}
      title="Drafts"
      to="/drafts"
    />
  );
}
