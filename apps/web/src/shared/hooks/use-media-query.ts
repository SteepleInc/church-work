import { useEffect, useState } from "react";

function useMinWidth(minWidth: number) {
  const [matches, setMatches] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setMatches(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, [minWidth]);

  return matches;
}

export function useIsSmScreen() {
  return useMinWidth(640);
}

export function useIsMdScreen() {
  return useMinWidth(768);
}

export function useIsLgScreen() {
  return useMinWidth(1024);
}

export function useIsXlScreen() {
  return useMinWidth(1280);
}
