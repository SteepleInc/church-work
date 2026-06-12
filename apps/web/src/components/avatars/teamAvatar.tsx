import { getTeamColorForName, isTeamColor, type TeamColor } from "@church-task/domain";
import type { FC } from "react";

import { Avatar, AvatarFallback, getAvatarInitials } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Team Color token -> Tailwind classes. Tokens come from TEAM_COLORS in
// @church-task/domain; Tailwind needs literal class strings, so the mapping
// lives here on the web side.
const TEAM_COLOR_CLASSES: Record<TeamColor, string> = {
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  teal: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
};

type TeamAvatarProps = {
  readonly name: string;
  readonly color?: string | null;
  readonly size?: number;
  readonly className?: string;
};

export const TeamAvatar: FC<TeamAvatarProps> = (props) => {
  const { name, color, size = 40, className } = props;
  // Teams created before colors were stored fall back to the same
  // name-derived color the create path would have assigned.
  const resolvedColor = isTeamColor(color) ? color : getTeamColorForName(name);
  // Squircle: corner radius and initials scale with the avatar size so small
  // avatars (e.g. the 18px dialog pill) stay legible instead of overflowing.
  const borderRadius = Math.round(size * 0.28);
  const fontSize = Math.max(8, Math.round(size * 0.4));

  return (
    <Avatar className={className} style={{ borderRadius, height: size, width: size }}>
      <AvatarFallback
        className={cn("font-semibold", TEAM_COLOR_CLASSES[resolvedColor])}
        style={{ borderRadius, fontSize }}
      >
        {getAvatarInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};
