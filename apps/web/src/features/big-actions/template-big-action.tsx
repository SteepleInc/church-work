"use client";

import { noOp } from "@church-task/shared/noOps";
import { useLocation } from "@tanstack/react-router";
import { Boolean, Match, pipe } from "effect";
import { useAtom, useAtomValue } from "jotai";
import type { FC } from "react";
import { useEffect, useRef } from "react";

import { Step, Steps } from "@/components/ui/stepper";
import {
  BigActionHeader,
  BigActionTitle,
  BigActionWrapper,
} from "@/features/big-actions/big-action-components";
import {
  type TemplateBigActionShape,
  type TemplateBigActionState,
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

const SHAPE_TITLE: Record<TemplateBigActionShape, string> = {
  key_date: "New Key Date Template",
  monthly: "New Monthly Template",
  quarterly: "New Quarterly Template",
  weekly_service: "New Weekly Service Template",
  yearly: "New Yearly Template",
};

export const TemplateBigAction: FC = () => {
  const [state, setState] = useAtom(templateBigActionStateAtom);
  const pathname = useLocation({ select: (location) => location.pathname });
  const quickActionsIsOpen = useAtomValue(quickActionsIsOpenAtom);
  const globalSearchIsOpen = useAtomValue(globalSearchIsOpenAtom);
  const previousPathname = useRef(pathname);

  const close = () => setState(TemplateBigActionStateEnum.closed());

  useEffect(() => {
    if (previousPathname.current === pathname) return;

    previousPathname.current = pathname;
    setState(TemplateBigActionStateEnum.closed());
  }, [pathname, setState]);

  useEffect(() => {
    if (!quickActionsIsOpen && !globalSearchIsOpen) return;

    setState(TemplateBigActionStateEnum.closed());
  }, [globalSearchIsOpen, quickActionsIsOpen, setState]);

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
    <BigActionWrapper
      onOpenChange={(open) =>
        pipe(
          open,
          Boolean.match({
            onFalse: close,
            onTrue: noOp,
          }),
        )
      }
      open={state._tag !== "closed"}
    >
      {state._tag === "closed" ? null : (
        <div className="flex h-full flex-col overflow-hidden bg-background">
          <BigActionHeader>
            <BigActionTitle>
              {pipe(
                Match.type<TemplateBigActionState>(),
                Match.tag("create", ({ shape }) => SHAPE_TITLE[shape]),
                Match.tag("closed", () => ""),
                Match.exhaustive,
              )(state)}
            </BigActionTitle>
          </BigActionHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b px-6 py-4 pb-5">
              <Steps
                activeStep={Math.min(state.step, templateFlowStepCount(state.shape) - 1)}
                onClickStep={handleStepClick}
                orientation="horizontal"
                responsive
              >
                {TEMPLATE_FLOW_STEPS[state.shape].map((entry) => (
                  <Step description={entry.description} key={entry.label} label={entry.label} />
                ))}
              </Steps>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TemplateAuthoringFlow
                onClose={close}
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
  );
};
