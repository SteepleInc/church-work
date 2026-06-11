import { ArrowRightIcon } from "@/components/icons/arrowRightIcon";
import { COMPLETED_APP_LANDING_PATH } from "@/components/app-shell-utils";
import { AnimatedGroup } from "@/components/motion-primitives/animatedGroup";
import { TextEffect } from "@/components/motion-primitives/textEffect";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_marketing/")({
  component: HomePage,
});

const TEAM_TIERS = [
  ["1 - 5 teams", "$0"],
  ["6 - 15 teams", "Custom"],
  ["16 - 50 teams", "Custom"],
  ["50+ teams", "Custom"],
] as const;

function HomePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session) {
      void router.preloadRoute({ to: COMPLETED_APP_LANDING_PATH });
    } else {
      void router.preloadRoute({ to: "/sign-in" });
    }
  }, [router, session]);

  const getStartedLink = session ? COMPLETED_APP_LANDING_PATH : "/sign-in";

  return (
    <div className="flex flex-col bg-black">
      <div className="lg:hidden">
        <section className="bg-cream px-6 py-34 sm:px-12">
          <div className="mx-auto flex max-w-[1008px] flex-col gap-8">
            <div className="flex flex-col items-start gap-[40px]">
              <TextEffect
                as="h1"
                className="-mt-[10px] max-w-2xl font-normal font-serif text-[min(112px,calc((100vw-48px)/6.96))] text-black leading-none"
                delay={0.4}
                per="char"
                preset="slide"
                speedSegment={0.3}
              >
                Workflows For Churches
              </TextEffect>
              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        delayChildren: 0.8,
                      },
                    },
                  },
                  item: {
                    hidden: {
                      filter: "blur(8px)",
                      opacity: 0,
                      y: 16,
                    },
                    visible: {
                      filter: "blur(0px)",
                      opacity: 1,
                      transition: {
                        bounce: 0.18,
                        duration: 2,
                        type: "spring",
                      },
                      y: 0,
                    },
                  },
                }}
              >
                <Button asChild size="marketing" variant="marketing-hero">
                  <Link to={getStartedLink}>
                    Get Started
                    <ArrowRightIcon />
                  </Link>
                </Button>
              </AnimatedGroup>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-12 md:pt-32 md:pb-20">
          <AnimatedGroup
            className="mx-auto w-full max-w-[1008px]"
            variants={{
              container: {
                visible: {
                  transition: {
                    delayChildren: 1.11,
                    staggerChildren: 0.2,
                  },
                },
              },
              item: {
                hidden: {
                  filter: "blur(8px)",
                  opacity: 0,
                  y: 16,
                },
                visible: {
                  filter: "blur(0px)",
                  opacity: 1,
                  transition: {
                    duration: 0.6,
                  },
                  y: 0,
                },
              },
            }}
          >
            <h2 className="mb-6 max-w-[816px] font-serif text-[48px] text-white leading-[48px] tracking-tight md:text-[58px] md:leading-[58px]">
              Shared task clarity, built for church teams.
            </h2>
            <p className="mb-10 max-w-[816px] font-light text-[31px] text-cream md:text-[38px]">
              Coordinate ministry work across Churches, Teams, Workflows, and Tasks without another
              spreadsheet.
            </p>
            <Button asChild size="marketing" variant="marketing-secondary">
              <Link to={getStartedLink}>
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
          </AnimatedGroup>
        </section>
      </div>

      <div className="hidden min-h-[calc(100vh-168px)] lg:flex">
        <section className="flex w-1/2 flex-col justify-center bg-cream px-12 py-20">
          <div className="flex flex-col items-start gap-[40px]">
            <TextEffect
              as="h1"
              className="max-w-xl font-normal font-serif text-[72px] text-black leading-none xl:text-[101px]"
              delay={0.4}
              per="char"
              preset="slide"
              speedSegment={0.3}
            >
              Workflows For Churches
            </TextEffect>
            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      delayChildren: 0.8,
                    },
                  },
                },
                item: {
                  hidden: {
                    filter: "blur(8px)",
                    opacity: 0,
                    y: 16,
                  },
                  visible: {
                    filter: "blur(0px)",
                    opacity: 1,
                    transition: {
                      bounce: 0.18,
                      duration: 2,
                      type: "spring",
                    },
                    y: 0,
                  },
                },
              }}
            >
              <Button asChild size="marketing" variant="marketing-hero">
                <Link to={getStartedLink}>
                  Get Started
                  <ArrowRightIcon />
                </Link>
              </Button>
            </AnimatedGroup>
          </div>
        </section>

        <section className="flex w-1/2 flex-col justify-center bg-black px-12 py-20">
          <AnimatedGroup
            className="w-full"
            variants={{
              container: {
                visible: {
                  transition: {
                    delayChildren: 1.11,
                    staggerChildren: 0.2,
                  },
                },
              },
              item: {
                hidden: {
                  filter: "blur(8px)",
                  opacity: 0,
                  y: 16,
                },
                visible: {
                  filter: "blur(0px)",
                  opacity: 1,
                  transition: {
                    duration: 0.6,
                  },
                  y: 0,
                },
              },
            }}
          >
            <h2 className="mb-6 font-serif text-[58px] text-white leading-[58px] tracking-tight">
              Shared task clarity, built for church teams.
            </h2>
            <p className="font-light text-[38px] text-cream">
              Coordinate ministry work across Churches, Teams, Workflows, and Tasks without another
              spreadsheet.
            </p>
          </AnimatedGroup>
        </section>
      </div>

      <section className="bg-cream px-6 py-20 sm:px-12 lg:bg-black lg:py-32">
        <div className="mx-auto max-w-[1008px]">
          <h2 className="mb-16 font-serif text-[48px] text-black leading-[48px] tracking-tight md:text-[58px] md:leading-[58px] lg:text-white">
            How It Works
          </h2>

          <div className="grid gap-12 md:grid-cols-3 md:gap-8">
            <div className="flex flex-col gap-4">
              <span className="font-serif text-[72px] text-black/20 leading-none lg:text-white/40">
                1
              </span>
              <h3 className="font-serif text-[28px] text-black leading-tight lg:text-white">
                Churches Set Up Teams
              </h3>
              <p className="font-light text-[18px] text-black/70 lg:text-cream/70">
                Create the ministry teams that own recurring work.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <span className="font-serif text-[72px] text-black/20 leading-none lg:text-white/40">
                2
              </span>
              <h3 className="font-serif text-[28px] text-black leading-tight lg:text-white">
                Workflows Create Tasks
              </h3>
              <p className="font-light text-[18px] text-black/70 lg:text-cream/70">
                Turn repeatable church operations into clear assignments.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <span className="font-serif text-[72px] text-black/20 leading-none lg:text-white/40">
                3
              </span>
              <h3 className="font-serif text-[28px] text-black leading-tight lg:text-white">
                People Finish Work
              </h3>
              <p className="font-light text-[18px] text-black/70 lg:text-cream/70">
                Everyone sees My Work, Our Work, and what needs attention next.
              </p>
            </div>
          </div>

          <div className="mt-12 flex justify-center">
            <Button asChild className="lg:hidden" size="marketing" variant="marketing-hero">
              <Link to={getStartedLink}>
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              asChild
              className="hidden lg:inline-flex"
              size="marketing"
              variant="marketing-secondary"
            >
              <Link to={getStartedLink}>
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-12 lg:bg-cream lg:py-32">
        <div className="mx-auto max-w-[1008px]">
          <h2 className="mb-4 font-serif text-[48px] text-white leading-[48px] tracking-tight md:text-[58px] md:leading-[58px] lg:text-black">
            Built For Every Church Team
          </h2>
          <p className="mb-8 font-light text-[24px] text-cream/70 lg:text-black/70">
            Start simple, then scale workflows as your ministry operations grow.
          </p>

          <div className="overflow-hidden rounded-lg border border-white/10 lg:border-black/10">
            <table className="w-full">
              <thead>
                <tr className="border-white/10 border-b lg:border-black/10">
                  <th className="px-4 py-4 text-left font-light text-[16px] text-cream/50 uppercase tracking-wider sm:px-6 lg:text-black/50">
                    Team Count
                  </th>
                  <th className="px-4 py-4 text-right font-light text-[16px] text-cream/50 uppercase tracking-wider lg:text-black/50">
                    Plan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 lg:divide-black/10">
                {TEAM_TIERS.map(([tier, price]) => (
                  <tr key={tier}>
                    <td className="px-4 py-5 font-light text-[20px] text-white sm:px-6 lg:text-black">
                      {tier}
                    </td>
                    <td className="px-4 py-5 text-right font-serif text-[24px] text-cream lg:text-black">
                      {price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-center font-light text-[16px] text-cream/50 lg:text-black/50">
            Church Task is being shaped with churches before public pricing is finalized.
          </p>

          <div className="mt-12 flex justify-center">
            <Button asChild className="lg:hidden" size="marketing" variant="marketing-secondary">
              <Link to={getStartedLink}>
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              asChild
              className="hidden lg:inline-flex"
              size="marketing"
              variant="marketing-hero"
            >
              <Link to={getStartedLink}>
                Get Started
                <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
