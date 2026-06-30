"use client";

import { noOp } from "@church-work/shared/noOps";
import { useLocation } from "@tanstack/react-router";
import { Boolean, pipe } from "effect";
import { useAtom, useAtomValue } from "jotai";
import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Step, Steps } from "@/components/ui/stepper";
import {
  BigActionHeader,
  BigActionTitle,
  BigActionWrapper,
} from "@/features/big-actions/big-action-components";
import {
  type TemplateBigActionShape,
  TemplateBigActionState as TemplateBigActionStateEnum,
  templateBigActionStateAtom,
} from "@/features/big-actions/big-action-state";
import { globalSearchIsOpenAtom } from "@/features/global-search/global-search-state";
import { quickActionsIsOpenAtom } from "@/features/quick-actions/quick-actions-state";
import {
  TEMPLATE_FLOW_STEPS,
  TemplateAuthoringFlow,
  templateFlowStepCount,
} from "@/features/templates/template-authoring";

// The title is intentionally shape-agnostic: the Template shape is chosen inside
// the Setup step, so the big action header stays a constant "New Template".
const TEMPLATE_BIG_ACTION_TITLE = "New Template";

export const TemplateBigAction: FC = () => {
  const [state, setState] = useAtom(templateBigActionStateAtom);
  const pathname = useLocation({ select: (location) => location.pathname });
  const quickActionsIsOpen = useAtomValue(quickActionsIsOpenAtom);
  const globalSearchIsOpen = useAtomValue(globalSearchIsOpenAtom);
  const previousPathname = useRef(pathname);
  // The authoring flow reports its unsaved-edit state here; the close guard
  // reads the latest value to decide whether to prompt before discarding.
  const isDirtyRef = useRef(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const close = () => {
    isDirtyRef.current = false;
    setConfirmDiscardOpen(false);
    setState(TemplateBigActionStateEnum.closed());
  };

  // Closing with unsaved edits prompts before discarding; a pristine flow closes
  // immediately. The header X, Escape, and outside-click all dismiss the modal
  // via `onOpenChange(false)`, so this one guard covers every close affordance.
  const requestClose = () => {
    if (isDirtyRef.current) {
      setConfirmDiscardOpen(true);
      return;
    }
    close();
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  // Navigations and other overlays force the big action shut without a discard
  // prompt (the User's intent is elsewhere); clear the guard so a stale dirty
  // flag never trips the next open.
  const forceClose = useCallback(() => {
    isDirtyRef.current = false;
    setConfirmDiscardOpen(false);
    setState(TemplateBigActionStateEnum.closed());
  }, [setState]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;

    previousPathname.current = pathname;
    forceClose();
  }, [forceClose, pathname]);

  useEffect(() => {
    if (!quickActionsIsOpen && !globalSearchIsOpen) return;

    forceClose();
  }, [forceClose, globalSearchIsOpen, quickActionsIsOpen]);

  const setStep = (step: number) =>
    setState((current) =>
      current._tag === "create" ? TemplateBigActionStateEnum.create({ ...current, step }) : current,
    );

  const setShape = (shape: TemplateBigActionShape) =>
    setState((current) =>
      current._tag === "create"
        ? TemplateBigActionStateEnum.create({ ...current, shape })
        : current,
    );

  const handleStepClick = (next: number) => {
    if (state._tag === "create" && next <= state.step) setStep(next);
  };

  return (
    <>
      <BigActionWrapper
        onOpenChange={(open) =>
          pipe(
            open,
            Boolean.match({
              onFalse: requestClose,
              onTrue: noOp,
            }),
          )
        }
        open={state._tag !== "closed"}
      >
        {state._tag === "closed" ? null : (
          <div className="flex h-full flex-col overflow-hidden bg-background">
            <BigActionHeader>
              <BigActionTitle>{TEMPLATE_BIG_ACTION_TITLE}</BigActionTitle>
            </BigActionHeader>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b px-6 py-4 pb-5">
                <Steps
                  activeStep={Math.min(state.step, templateFlowStepCount() - 1)}
                  onClickStep={handleStepClick}
                  orientation="horizontal"
                  responsive
                >
                  {TEMPLATE_FLOW_STEPS.map((entry) => (
                    <Step description={entry.description} key={entry.label} label={entry.label} />
                  ))}
                </Steps>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <TemplateAuthoringFlow
                  onClose={close}
                  onDirtyChange={handleDirtyChange}
                  onShapeChange={(shape) => setShape(shape as TemplateBigActionShape)}
                  onStepChange={setStep}
                  shape={state.shape}
                  step={state.step}
                />
              </div>
            </div>
          </div>
        )}
      </BigActionWrapper>
      {/* Rendered as a sibling of the big action modal — not a child — so
          base-ui does not treat it as a nested dialog. A nested dialog
          suppresses its own backdrop and offsets its popup; kept top-level, the
          confirmation centers and lays its own backdrop over the big action. */}
      <DiscardChangesDialog
        description="You have an unsaved Template. If you close now, it'll be lost."
        onDiscard={close}
        onOpenChange={setConfirmDiscardOpen}
        open={confirmDiscardOpen}
      />
    </>
  );
};
