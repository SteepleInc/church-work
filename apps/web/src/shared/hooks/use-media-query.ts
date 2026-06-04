import { useEffect, useState } from "react";

export function useIsMdScreen() {
  const [isMdScreen, setIsMdScreen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsMdScreen(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isMdScreen;
}
