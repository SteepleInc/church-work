"use client";

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { Boolean, pipe } from "effect";
import { Check, Loader2, X } from "lucide-react";
import type { FC, HTMLAttributes, ReactElement, ReactNode } from "react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  memo,
  useContext,
  useMemo,
} from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIsMdScreen } from "@/shared/hooks/use-media-query";

/********** Context **********/

interface StepsContextValue extends StepsProps {
  isClickable?: boolean;
  isError?: boolean;
  isLoading?: boolean;
  isVertical?: boolean;
  isLabelVertical?: boolean;
  stepCount?: number;
}

const StepsContext = createContext<StepsContextValue>({
  activeStep: 0,
});

export const useStepperContext = () => useContext(StepsContext);

export const StepsProvider: FC<{
  value: StepsContextValue;
  children: ReactNode;
}> = ({ value, children }) => {
  const isError = value.state === "error";
  const isLoading = value.state === "loading";

  const isVertical = value.orientation === "vertical";
  const isLabelVertical = value.orientation !== "vertical" && value.labelOrientation === "vertical";

  return (
    <StepsContext.Provider
      value={{
        ...value,
        isError,
        isLabelVertical,
        isLoading,
        isVertical,
      }}
    >
      {children}
    </StepsContext.Provider>
  );
};

/********** Steps **********/

export interface StepsProps extends HTMLAttributes<HTMLDivElement> {
  activeStep: number;
  orientation?: "vertical" | "horizontal";
  state?: "loading" | "error";
  responsive?: boolean;
  onClickStep?: (step: number) => void;
  successIcon?: ReactElement;
  errorIcon?: ReactElement;
  labelOrientation?: "vertical" | "horizontal";
  children?: ReactNode;
  variant?: "default" | "ghost" | "outline" | "secondary";
}

export const Steps = forwardRef<HTMLDivElement, StepsProps>(
  (
    {
      activeStep = 0,
      state,
      responsive = true,
      orientation: orientationProp = "horizontal",
      onClickStep,
      labelOrientation = "horizontal",
      children,
      errorIcon,
      successIcon,
      variant = "default",
      className,
      ...props
    },
    ref,
  ) => {
    const childArr = Children.toArray(children);

    const stepCount = childArr.length;

    const renderHorizontalContent = () => {
      if (activeStep <= childArr.length) {
        return Children.map(childArr[activeStep], (node) => {
          if (!isValidElement(node)) {
            return;
          }
          // biome-ignore lint/suspicious/noExplicitAny: stepper child cloning
          return Children.map((node as any).props.children, (childNode) => childNode);
        });
      }
      return null;
    };

    const isClickable = !!onClickStep;

    const isMdScreen = useIsMdScreen();

    const orientation = !isMdScreen && responsive ? "vertical" : orientationProp;

    return (
      <StepsProvider
        value={{
          activeStep,
          errorIcon,
          isClickable,
          labelOrientation,
          onClickStep,
          orientation,
          responsive,
          state,
          stepCount,
          successIcon,
          variant,
        }}
      >
        <div
          {...props}
          className={cn(
            "flex w-full flex-1 justify-between gap-4 overflow-hidden text-center md:overflow-visible!",
            orientation === "vertical" ? "flex-col" : "flex-row",
            "pb-2", // Add padding bottom to prevent shadow clipping
            className,
          )}
          ref={ref}
        >
          {Children.map(children, (child, i) => {
            const isCompletedStep =
              // biome-ignore lint/suspicious/noExplicitAny: stepper child cloning
              (isValidElement(child) && (child as any).props.isCompletedStep) ?? i < activeStep;
            const isLastStep = i === stepCount - 1;
            const isCurrentStep = i === activeStep;

            const stepProps = {
              index: i,
              isCompletedStep,
              isCurrentStep,
              isLastStep,
            };

            if (isValidElement(child)) {
              return cloneElement(child, stepProps);
            }

            return null;
          })}
        </div>
        {orientation === "horizontal" && renderHorizontalContent()}
      </StepsProvider>
    );
  },
);

Steps.displayName = "Steps";

/********** Step **********/

const stepVariants = cva("relative flex flex-row gap-2", {
  compoundVariants: [
    {
      class: "w-full flex-col items-start justify-start md:flex-[1_0_auto]",
      isLastStep: true,
      isVertical: true,
    },
  ],
  variants: {
    isClickable: {
      true: "cursor-pointer",
    },
    isCurrentStep: {
      true: "flex-1 overflow-hidden",
    },
    isLastStep: {
      false: "justify-start md:flex-[1_0_auto]!",
      true: "justify-end md:flex-[0_0_auto]!",
    },
    isVertical: {
      false: "items-center",
      true: "flex-col",
    },
  },
});

export interface StepConfig extends StepLabelProps {
  icon?: ReactElement;
}

export interface StepProps
  extends
    Omit<HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof stepVariants>,
    StepConfig {
  isCompletedStep?: boolean;
  index?: number;
  isCurrentStep?: boolean;
  isLastStep?: boolean;
  children?: ReactNode;
}

interface StepStatus {
  index: number;
  isCompletedStep?: boolean;
  isCurrentStep?: boolean;
  isLastStep?: boolean;
}

export const Step = forwardRef<HTMLDivElement, StepProps>((props, ref) => {
  const {
    children,
    description,
    icon: CustomIcon,
    index = 0,
    isCompletedStep,
    isCurrentStep,
    isLastStep = false,
    label,
    optional,
    optionalLabel,
    className,
    ...rest
  } = props as StepProps &
    StepStatus & {
      additionalClassName?: { button?: string; label?: string; description?: string };
    };

  const additionalClassName = (
    props as StepProps & {
      additionalClassName?: { button?: string; label?: string; description?: string };
    }
  ).additionalClassName;

  const {
    isVertical,
    isError,
    isLoading,
    successIcon: CustomSuccessIcon,
    errorIcon: CustomErrorIcon,
    isLabelVertical,
    onClickStep,
    isClickable,
    variant: variantFromContext,
  } = useStepperContext();

  const variant: "default" | "ghost" | "outline" | "secondary" =
    variantFromContext === "ghost" ||
    variantFromContext === "outline" ||
    variantFromContext === "secondary"
      ? variantFromContext
      : "default";

  const hasVisited = isCurrentStep ?? isCompletedStep;

  const handleClick = (i: number) => {
    if (isClickable && onClickStep) {
      onClickStep(i);
    }
  };

  const Icon = useMemo(() => CustomIcon ?? null, [CustomIcon]);

  const Success = useMemo(() => CustomSuccessIcon ?? <Check />, [CustomSuccessIcon]);

  const ErrorIcon = useMemo(() => CustomErrorIcon ?? <X />, [CustomErrorIcon]);

  const RenderIcon = useMemo(() => {
    if (isCompletedStep) {
      return Success;
    }
    if (isCurrentStep) {
      if (isError) {
        return ErrorIcon;
      }
      if (isLoading) {
        return <Loader2 className="animate-spin" />;
      }
    }
    if (Icon) {
      return Icon;
    }
    return (index || 0) + 1;
  }, [isCompletedStep, Success, isCurrentStep, Icon, index, isError, ErrorIcon, isLoading]);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: this is the way
    // biome-ignore lint/a11y/useKeyWithClickEvents: this is the way
    // biome-ignore lint/a11y/noStaticElementInteractions: this is the way
    <div
      {...rest}
      aria-disabled={!hasVisited}
      className={cn(
        stepVariants({
          isClickable: isClickable && !!onClickStep,
          isCurrentStep,
          isLastStep,
          isVertical,
        }),
        className,
      )}
      onClick={() => handleClick(index)}
      ref={ref}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isLabelVertical ? "flex-col" : "",
          "pb-1", // Add padding bottom to prevent shadow clipping
        )}
      >
        <Button
          aria-current={isCurrentStep ? "step" : undefined}
          className={cn(
            "aspect-square size-10 rounded-full data-[highlighted=true]:bg-green-700 data-[highlighted=true]:text-white",
            (isCompletedStep ?? typeof RenderIcon !== "number") ? "px-2.5 py-2" : "",
            additionalClassName?.button,
          )}
          data-clickable={isClickable}
          data-highlighted={isCompletedStep}
          data-invalid={isCurrentStep && isError}
          disabled={!hasVisited}
          // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: variant resolution
          variant={(() => {
            if (isCurrentStep && isError) {
              return "destructive" as const;
            }
            if (isCompletedStep) {
              if (variant === "ghost") return "ghost" as const;
              if (variant === "outline") return "outline" as const;
              if (variant === "secondary") return "secondary" as const;
              return "default" as const;
            }
            if (isCurrentStep) {
              if (variant === "ghost") return "ghost" as const;
              if (variant === "outline") return "outline" as const;
              if (variant === "secondary") return "secondary" as const;
              return "default" as const;
            }
            return "outline" as const;
          })()}
        >
          {RenderIcon}
        </Button>
        <StepLabel
          description={description}
          descriptionClassName={additionalClassName?.description}
          label={label}
          labelClassName={additionalClassName?.label}
          optional={optional}
          optionalLabel={optionalLabel}
          {...{ isCurrentStep }}
        />
      </div>
      <Connector
        hasLabel={!!label || !!description}
        index={index}
        isCompletedStep={isCompletedStep ?? false}
        isLastStep={isLastStep}
      >
        {(isCurrentStep ?? isCompletedStep) ? children : null}
      </Connector>
    </div>
  );
});

Step.displayName = "Step";

/********** StepLabel **********/

interface StepLabelProps {
  label: string | ReactNode;
  description?: string | ReactNode;
  optional?: boolean;
  optionalLabel?: string | ReactNode;
  labelClassName?: string;
  descriptionClassName?: string;
}

const StepLabel = ({
  isCurrentStep = false,
  label,
  description,
  optional,
  optionalLabel,
  labelClassName,
  descriptionClassName,
}: StepLabelProps & {
  isCurrentStep?: boolean;
}) => {
  const { isLabelVertical } = useStepperContext();

  const shouldRender = !!label || !!description;

  const renderOptionalLabel = !!optional && !!optionalLabel;

  return shouldRender ? (
    <div
      aria-current={isCurrentStep ? "step" : undefined}
      className={cn(
        "flex w-max flex-col justify-center",
        isLabelVertical ? "items-center text-center" : "items-start text-left",
      )}
    >
      {!!label && (
        <p
          className={cn(
            pipe(
              isCurrentStep,
              Boolean.match({
                onFalse: () => "font-semibold text-muted-foreground",
                onTrue: () => "font-bold",
              }),
            ),
            labelClassName,
          )}
        >
          {label}
          {renderOptionalLabel ? (
            <span className="ml-1 text-muted-foreground text-xs">({optionalLabel})</span>
          ) : null}
        </p>
      )}
      {!!description && (
        <p className={cn("text-muted-foreground text-sm", descriptionClassName)}>{description}</p>
      )}
    </div>
  ) : null;
};

StepLabel.displayName = "StepLabel";

/********** Connector **********/

interface ConnectorProps extends HTMLAttributes<HTMLDivElement> {
  isCompletedStep: boolean;
  isLastStep?: boolean | null;
  hasLabel?: boolean;
  index: number;
}

const Connector = memo(({ isCompletedStep, children, isLastStep }: ConnectorProps) => {
  const { isVertical = false } = useStepperContext();

  if (isVertical) {
    return (
      <div
        className={cn(
          "mt-1 flex h-auto min-h-[2rem] flex-1 self-stretch border-l-2 md:ms-6 md:ps-8",
          isLastStep ? "min-h-0 border-transparent" : "",
          isCompletedStep ? "ms-6 border-green-700 ps-8" : "",
        )}
        data-highlighted={isCompletedStep}
      >
        {!isCompletedStep && <div className="block h-auto w-full md:my-4">{children}</div>}
      </div>
    );
  }

  if (isLastStep) {
    return null;
  }

  return (
    <Separator
      className="flex h-[2px] min-h-[auto] flex-1 self-auto data-[highlighted=true]:bg-green-700"
      data-highlighted={isCompletedStep}
      orientation="horizontal"
    />
  );
});

Connector.displayName = "Connector";
