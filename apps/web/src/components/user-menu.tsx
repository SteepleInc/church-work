import { LogOutIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatars/userAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItemWithLoading,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearIntentionalSignOut, markIntentionalSignOut } from "@/features/auth/sign-out-routing";
import { useNavigate } from "@tanstack/react-router";

import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type UserMenuProps = ComponentProps<typeof Button> & {
  readonly avatarSize?: number;
};

export default function UserMenu({ avatarSize = 24, className, ...buttonProps }: UserMenuProps) {
  const navigate = useNavigate();
  const { session } = useSession();
  const currentUser = session?.user ?? null;
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    markIntentionalSignOut();
    setIsSigningOut(true);

    await authClient.signOut();
    await navigate({ to: "/" });
    clearIntentionalSignOut();

    setIsSigningOut(false);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn("size-10 rounded-full [&_svg]:size-[auto]", className)}
            size="icon"
            variant="ghost"
            {...buttonProps}
          />
        }
      >
        <UserAvatar
          avatar={currentUser?.image ?? null}
          name={currentUser?.name ?? null}
          size={avatarSize}
          userId={currentUser?.id ?? "user"}
        />
        <span className="sr-only">User menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItemWithLoading loading={isSigningOut} onClick={signOut}>
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItemWithLoading>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
