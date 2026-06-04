import { Option, pipe } from "effect";
import type { FunctionComponent, ReactNode } from "react";

import { AlertCircleIcon } from "@/components/icons/alertCircleIcon";

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
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start">
                  <AlertCircleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3 flex-1">
                    <p className="text-red-700 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ),
          }),
        )
      }
    </form.Subscribe>
  );
}
