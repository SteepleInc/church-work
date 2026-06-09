import { Boolean, Match, Option, pipe } from "effect";
import type { FunctionComponent, HTMLProps, ReactNode } from "react";

import { FormErrorDisplay } from "@/components/form/form-error-display";
import { cn } from "@/lib/utils";

export type FormStateWithErrorMap = {
  errorMap: {
    onSubmit?: unknown;
    onBlur?: unknown;
    onChange?: unknown;
    onMount?: unknown;
    onServer?: unknown;
  };
};

type FormProps = Omit<HTMLProps<HTMLFormElement>, "form"> & {
  form: {
    handleSubmit: () => Promise<void> | void;
    Subscribe: <TSelected = FormStateWithErrorMap>(props: {
      selector: (state: FormStateWithErrorMap) => TSelected;
      children: ((state: TSelected) => ReactNode) | ReactNode;
    }) => ReturnType<FunctionComponent>;
  };
};

export function Form({ form, children, className, ...domProps }: FormProps) {
  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
      {...domProps}
    >
      <FormErrorDisplay form={form} />
      {children}
      <input hidden type="submit" />
    </form>
  );
}

export const getSubmitButtonText = (
  params:
    | {
        _tag: "create";
      }
    | {
        _tag: "edit";
        clone?: boolean;
      },
) =>
  pipe(
    Match.type<typeof params>(),
    Match.tag("create", () => "Create"),
    Match.tag("edit", (value) =>
      pipe(
        value.clone,
        Option.fromNullable,
        Option.getOrElse(() => false),
        Boolean.match({
          onFalse: () => "Update",
          onTrue: () => "Clone",
        }),
      ),
    ),
    Match.exhaustive,
  )(params);
