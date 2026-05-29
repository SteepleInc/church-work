import { createFormHook } from "@tanstack/react-form";

import { InputField } from "@/components/form/input-field";
import { SelectField } from "@/components/form/select-field";
import { fieldContext, formContext } from "@/components/form/ts-field";

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    InputField,
    SelectField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
