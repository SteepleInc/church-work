import { Option, pipe } from "effect";
import type { FunctionComponent, ReactNode } from "react";

type ErrorMap = {
  onSubmit?: unknown;
  onBlur?: unknown;
  onChange?: unknown;
  onMount?: unknown;
  onServer?: unknown;
};

type FormStateWithErrorMap = {
  errorMap: ErrorMap;
};

type FormErrorDisplayProps = {
  form: {
    Subscribe: <TSelected = FormStateWithErrorMap>(props: {
      selector: (state: FormStateWithErrorMap) => TSelected;
      children: ((state: TSelected) => ReactNode) | ReactNode;
    }) => ReturnType<FunctionComponent>;
  };
};

export function FormErrorDisplay({ form }: FormErrorDisplayProps) {
  return (
    <form.Subscribe selector={(state) => state.errorMap}>
      {(errorMap: ErrorMap) =>
        pipe(
          Option.fromNullable(errorMap.onSubmit),
          Option.flatMap((error) => {
            if (typeof error === "object" && error !== null && "form" in error) {
              const formError = error.form;
              return typeof formError === "string" ? Option.some(formError) : Option.none();
            }
            return typeof error === "string" ? Option.some(error) : Option.none();
          }),
          Option.match({
            onNone: () => null,
            onSome: (errorMessage) => (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            ),
          }),
        )
      }
    </form.Subscribe>
  );
}
