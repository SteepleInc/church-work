import { Option, pipe } from "effect";
import type { ComponentProps, ReactNode } from "react";

import { Form } from "@/components/form/form";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const formColumnClassName = "flex flex-col gap-3 flex-1";

type CardFormProps = Omit<ComponentProps<typeof Form>, "children"> & {
  Primary: ReactNode;
  Secondary?: ReactNode;
  Actions?: ReactNode;
  showTopSeparator?: boolean;
  actionsClassName?: string;
};

export function CardForm({
  Primary,
  Secondary,
  Actions,
  form,
  className,
  showTopSeparator = false,
  actionsClassName,
  ...domProps
}: CardFormProps) {
  return (
    <>
      {showTopSeparator ? <Separator /> : null}

      <Form
        className={cn("flex w-full flex-col items-stretch gap-0", className)}
        form={form}
        {...domProps}
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <div className={cn(formColumnClassName, "max-w-sm")}>{Primary}</div>
          {pipe(
            Secondary,
            Option.fromNullable,
            Option.match({
              onNone: () => null,
              onSome: (content) => (
                <>
                  <Separator orientation="vertical" />
                  <div className={formColumnClassName}>{content}</div>
                </>
              ),
            }),
          )}
        </div>

        {pipe(
          Actions,
          Option.fromNullable,
          Option.match({
            onNone: () => null,
            onSome: (actions) => (
              <div className={cn("mt-6 flex items-center justify-end gap-3", actionsClassName)}>
                {actions}
              </div>
            ),
          }),
        )}
      </Form>
    </>
  );
}
