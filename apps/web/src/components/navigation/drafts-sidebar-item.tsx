import { FileTextIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SideBarItem } from "@/components/navigation/sidebar-item";
import { useMyDraftsCollection } from "@/data/drafts/draftsData.app";

const DRAFTS_SIDEBAR_EXIT_MS = 200;
const DRAFTS_SIDEBAR_ANIMATION_CLASSNAME =
  "motion-safe:transition-[opacity,transform,max-height,margin] motion-safe:duration-200 data-[state=closed]:pointer-events-none data-[state=closed]:-mt-px data-[state=closed]:max-h-0 data-[state=closed]:-translate-y-0.5 data-[state=closed]:overflow-hidden data-[state=closed]:opacity-0 data-[state=closed]:ease-in data-[state=open]:mt-0 data-[state=open]:max-h-8 data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=open]:ease-out";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function DraftsSidebarItem() {
  const { collection } = useMyDraftsCollection();
  const draftCount = collection.length;
  const [isMounted, setIsMounted] = useState(draftCount > 0);
  const [isVisible, setIsVisible] = useState(draftCount > 0);
  const [displayCount, setDisplayCount] = useState(draftCount);

  useEffect(() => {
    if (draftCount > 0) {
      setDisplayCount(draftCount);
      setIsMounted(true);
      const frameId = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    setIsVisible(false);
    const exitDelay = prefersReducedMotion() ? 0 : DRAFTS_SIDEBAR_EXIT_MS;
    const timeoutId = window.setTimeout(() => setIsMounted(false), exitDelay);
    return () => window.clearTimeout(timeoutId);
  }, [draftCount]);

  if (!isMounted) return null;

  return (
    <SideBarItem
      badge={displayCount}
      className={DRAFTS_SIDEBAR_ANIMATION_CLASSNAME}
      icon={<FileTextIcon className="size-4" />}
      state={isVisible ? "open" : "closed"}
      title="Drafts"
      to="/drafts"
    />
  );
}
