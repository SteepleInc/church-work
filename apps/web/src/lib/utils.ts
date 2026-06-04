import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let isMac: boolean | undefined;

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

function getPlatform() {
  if (typeof navigator === "undefined") return "";

  const nav = navigator as NavigatorWithUserAgentData;

  if (nav.userAgentData?.platform) {
    return nav.userAgentData.platform;
  }

  return typeof navigator.platform === "string" ? navigator.platform : "";
}

export function getIsMacOS() {
  if (isMac === undefined) {
    isMac = getPlatform().toLowerCase().includes("mac");
  }

  return isMac;
}

export function getShortcutKey(key: string): {
  symbol: string;
  readable: string;
  root: "mod" | "alt" | "shift" | "enter" | "other";
} {
  const isMacOS = getIsMacOS();

  switch (key.toLowerCase()) {
    case "mod":
      return isMacOS
        ? { readable: "Command", root: "mod", symbol: "⌘" }
        : { readable: "Control", root: "mod", symbol: "Ctrl" };
    case "alt":
      return isMacOS
        ? { readable: "Option", root: "alt", symbol: "⌥" }
        : { readable: "Alt", root: "alt", symbol: "Alt" };
    case "shift":
      return isMacOS
        ? { readable: "Shift", root: "shift", symbol: "⇧" }
        : { readable: "Shift", root: "shift", symbol: "Shift" };
    case "enter":
      return { readable: "Enter", root: "enter", symbol: "↵" };
    default:
      return { readable: key, root: "other", symbol: key };
  }
}
