"use client";

import { Link, useRouter } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

type MobileMarketingNavigationProps = {
  className?: string;
};

export const MobileMarketingNavigation = (props: MobileMarketingNavigationProps) => {
  const { className, ...domProps } = props;
  const [open, setOpen] = useState(false);
  const { session } = useSession();

  const onOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerTrigger asChild>
        <Button
          className={cn(
            "h-8 gap-4 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden",
            className,
          )}
          variant="ghost"
          {...domProps}
        >
          <svg
            className="size-6!"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3.75 9h16.5m-16.5 6.75h16.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80svh] p-0">
        <div className="overflow-auto p-6">
          <div className="flex flex-col space-y-3">
            <MobileLink onOpenChange={setOpen} to="/">
              Home
            </MobileLink>
            <MobileLink onOpenChange={setOpen} to="/library">
              Library
            </MobileLink>
            {session ? (
              <MobileLink onOpenChange={setOpen} to="/my-work">
                Dashboard
              </MobileLink>
            ) : (
              <MobileLink onOpenChange={setOpen} to="/sign-in">
                Sign In
              </MobileLink>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

type MobileLinkProps = {
  to: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

function MobileLink({ to, onOpenChange, className, children }: MobileLinkProps) {
  const router = useRouter();

  return (
    <Link
      className={cn("text-[1.15rem]", className)}
      onClick={() => {
        void router.navigate({ to });
        onOpenChange?.(false);
      }}
      to={to}
    >
      {children}
    </Link>
  );
}
