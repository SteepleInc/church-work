import { ArrowRightIcon } from "@/components/icons/arrowRightIcon";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

export const Route = createFileRoute("/_marketing/library")({
  component: LibraryPage,
});

const RESOURCE_CARDS = [
  {
    description: "See what belongs to you today.",
    name: "My Work",
    to: "/my-work",
  },
  {
    description: "Review every active task across the Church.",
    name: "Our Work",
    to: "/our-work",
  },
  {
    description: "Manage profile, Church, members, and invitations.",
    name: "Settings",
    to: "/settings/account/profile",
  },
] as const;

function LibraryPage() {
  return (
    <>
      <PageBanner
        ByLine="Jump into the core Church Task surfaces for teams, workflows, tasks, and settings."
        Title="A working library for church operations."
      />

      <div className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <CollectionCards />
        </div>
      </div>
    </>
  );
}

type PageBannerProps = {
  ByLine?: ReactNode;
  Title: ReactNode;
};

const PageBanner = (props: PageBannerProps) => {
  const { ByLine, Title } = props;

  return (
    <section className="mt-16 border-b">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-start gap-2 py-8 md:py-10 lg:py-12">
          <h1 className="font-bold text-3xl leading-tight tracking-tighter md:text-4xl lg:leading-[1.1]">
            {Title}
          </h1>
          {ByLine ? <p className="max-w-2xl font-light text-foreground text-lg">{ByLine}</p> : null}
        </div>
      </div>
    </section>
  );
};

type CollectionCardsProps = {
  className?: string;
  gridClassName?: string;
};

const CollectionCards = (props: CollectionCardsProps) => {
  const { className, gridClassName } = props;

  return (
    <section
      className={cn("[&>div]:p-0", className)}
      style={
        {
          "--radius": "0.75rem",
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          gridClassName,
        )}
      >
        {RESOURCE_CARDS.map((collection, index) => (
          <CollectionCard collection={collection} index={index} key={collection.name} />
        ))}
      </div>
    </section>
  );
};

type CollectionCardProps = {
  collection: (typeof RESOURCE_CARDS)[number];
  delay?: number;
  index: number;
};

const getAnimationDuration = (frames: number) => (1 / 60) * frames;

const CollectionCard = (props: CollectionCardProps) => {
  const { collection, delay = 0, index } = props;

  return (
    <Card
      asChild
      className="fade-in slide-in-from-left-1 slide-in-from-top-3 group animation-duration-300 relative flex h-48 animate-in justify-end overflow-hidden fill-mode-forwards px-8 py-4 transition-transform active:scale-[0.98]!"
      style={{
        animationDelay: `${getAnimationDuration(2 * (index + delay))}s`,
      }}
    >
      <Link to={collection.to}>
        <div className="absolute inset-0 h-full w-full overflow-hidden rounded-[inherit] bg-gradient-to-br from-primary/80 via-primary to-black transition-transform group-hover:scale-105" />
        <p className="relative flex flex-col gap-1 font-semibold text-white text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,.7)]">
          <span>{collection.name}</span>
          <span className="font-light text-sm text-white/75">{collection.description}</span>
          <ArrowRightIcon className="size-6" />
        </p>
      </Link>
    </Card>
  );
};
