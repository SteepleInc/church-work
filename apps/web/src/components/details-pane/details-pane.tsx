import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Array, Boolean, Match, Option, Record, pipe } from "effect";
import { XIcon } from "lucide-react";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  useCloseDetailsPane,
  useDetailsPaneState,
} from "@/components/details-pane/details-pane-helpers";
import { DetailsPaneHistory } from "@/components/details-pane/details-pane-history";
import type { DetailsPaneParams } from "@/components/details-pane/details-pane-types";
import { ToggleDetailsPaneButton } from "@/components/details-pane/toggle-details-pane-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { OrgDetailsPane } from "@/features/details-pane/org-details-pane";
import { TaskDetailsPane } from "@/features/details-pane/task-details-pane";
import { TeamDetailsPane } from "@/features/details-pane/team-details-pane";
import { UserDetailsPane } from "@/features/details-pane/user-details-pane";
import { cn } from "@/lib/utils";
import { detailsPaneStickyAtom } from "@/shared/global-state";
import { useIsMdScreen } from "@/shared/hooks/use-media-query";

const detailsPaneWidth = {
  default: "w-[28rem]",
} as const;

const getDetailsPaneWidth = (entityType: string): string =>
  pipe(
    detailsPaneWidth,
    Record.get(entityType as keyof typeof detailsPaneWidth),
    Option.getOrElse(() => detailsPaneWidth.default),
  );

export function DetailsPane({ className }: { readonly className?: string }) {
  const [detailsPaneState] = useDetailsPaneState();
  const closeDetailsPane = useCloseDetailsPane();
  const hasDetailsPane = useMemo(
    () => pipe(detailsPaneState, Array.isNonEmptyReadonlyArray),
    [detailsPaneState],
  );

  const width = pipe(
    detailsPaneState,
    Array.last,
    Option.match({
      onNone: () => detailsPaneWidth.default,
      onSome: (entity) => getDetailsPaneWidth(entity._tag),
    }),
  );

  return (
    <DetailsPaneWrapper
      className={className}
      closeDetailsPane={closeDetailsPane}
      detailsPaneParams={detailsPaneState}
      open={hasDetailsPane}
      width={width}
    >
      {pipe(
        detailsPaneState,
        Array.last,
        Option.match({
          onNone: () => null,
          onSome: (entity) =>
            pipe(
              entity,
              Match.value,
              Match.tag("org", (orgData) => (
                <OrgDetailsPane orgId={orgData.id} tab={orgData.tab} />
              )),
              // The pane URL param carries the Task Identifier (ADR 0013).
              Match.tag("task", (taskData) => <TaskDetailsPane identifier={taskData.id} />),
              Match.tag("team", (teamData) => <TeamDetailsPane teamId={teamData.id} />),
              Match.tag("user", (userData) => (
                <UserDetailsPane tab={userData.tab} userId={userData.id} />
              )),
              Match.exhaustive,
            ),
        }),
      )}
    </DetailsPaneWrapper>
  );
}

type DetailsPaneWrapperProps = {
  readonly children: ReactNode;
  readonly open: boolean;
  readonly closeDetailsPane: () => void;
  readonly width: string;
  readonly detailsPaneParams: DetailsPaneParams;
  readonly className?: string;
};

function DetailsPaneWrapper({
  children,
  open,
  closeDetailsPane,
  width,
  detailsPaneParams,
  className,
}: DetailsPaneWrapperProps) {
  const isMdScreen = useIsMdScreen();
  const detailsPaneSticky = useAtomValue(detailsPaneStickyAtom);

  return pipe(
    isMdScreen,
    Boolean.match({
      onFalse: () => (
        <Drawer
          onClose={closeDetailsPane}
          onOpenChange={(isOpen) =>
            pipe(isOpen, Boolean.match({ onFalse: closeDetailsPane, onTrue: () => undefined }))
          }
          open={open}
        >
          <DrawerContent className={cn("h-[100dvh] max-h-none", className)}>
            <DrawerTitle className="sr-only">Details Pane</DrawerTitle>
            <DrawerDescription className="sr-only">Details Pane</DrawerDescription>
            <DetailsPaneHistory history={detailsPaneParams} />
            {children}
          </DrawerContent>
        </Drawer>
      ),
      onTrue: () =>
        pipe(
          detailsPaneSticky,
          Boolean.match({
            onFalse: () => (
              <Dialog
                onOpenChange={(isOpen) =>
                  pipe(
                    isOpen,
                    Boolean.match({ onFalse: closeDetailsPane, onTrue: () => undefined }),
                  )
                }
                open={open}
              >
                <DialogContent
                  className={cn(
                    "top-2 right-2 bottom-2 left-auto h-auto max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl data-closed:slide-out-to-right-24 data-open:slide-in-from-right-24",
                    width,
                    className,
                  )}
                  closeButtonClassName="hidden"
                  hideCloseButton
                >
                  <DialogPrimitive.Title className="sr-only">Details Pane</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Details Pane
                  </DialogPrimitive.Description>
                  <DetailsPaneHistory history={detailsPaneParams} />
                  {children}
                  <div className="absolute top-3.5 right-4 z-50 flex flex-row items-center gap-1">
                    <ToggleDetailsPaneButton />
                    <DialogPrimitive.Close render={<Button size="icon-sm" variant="ghost" />}>
                      <XIcon className="size-4" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                </DialogContent>
              </Dialog>
            ),
            onTrue: () =>
              pipe(
                detailsPaneParams,
                Array.match({
                  onEmpty: () => null,
                  onNonEmpty: () => (
                    <div
                      aria-label="Details Pane"
                      className={cn(
                        "relative my-2 flex flex-col overflow-hidden rounded-l-2xl border bg-background shadow-sm",
                        width,
                        className,
                      )}
                    >
                      <div className="absolute top-3.5 right-4 z-50 flex flex-row items-center gap-1">
                        <ToggleDetailsPaneButton />
                        <Button onClick={closeDetailsPane} size="icon-sm" variant="ghost">
                          <XIcon className="size-4" />
                          <span className="sr-only">Close</span>
                        </Button>
                      </div>
                      <DetailsPaneHistory history={detailsPaneParams} />
                      {children}
                    </div>
                  ),
                }),
              ),
          }),
        ),
    }),
  );
}
