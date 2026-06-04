import { createFormHook } from "@tanstack/react-form";

import { AddressLocationField } from "@/components/form/address-location-field";
import { ComboboxField } from "@/components/form/combobox-field";
import { DatePickerField } from "@/components/form/date-picker-field";
import {
  OrgSelectField,
  OrgUserSelectField,
  UserSelectField,
} from "@/components/form/entity-select-fields";
import { InputField } from "@/components/form/input-field";
import { OTPField } from "@/components/form/otp-field";
import { SelectField } from "@/components/form/select-field";
import { SingleComboboxField } from "@/components/form/single-combobox-field";
import { SwitchField } from "@/components/form/switch-field";
import { TagInputField } from "@/components/form/tag-input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { fieldContext, formContext } from "@/components/form/ts-field";

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    AddressLocationField,
    ComboboxField,
    DatePickerField,
    InputField,
    OrgSelectField,
    OrgUserSelectField,
    OTPField,
    SelectField,
    SingleComboboxField,
    SwitchField,
    TagInputField,
    TextareaField,
    UserSelectField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
