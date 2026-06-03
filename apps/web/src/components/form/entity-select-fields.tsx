import {
  SingleComboboxField,
  type SingleComboboxFieldProps,
} from "@/components/form/single-combobox-field";

export function UserSelectField(props: SingleComboboxFieldProps) {
  return <SingleComboboxField placeholder="Select a user" {...props} />;
}

export function OrgSelectField(props: SingleComboboxFieldProps) {
  return <SingleComboboxField placeholder="Select a church" {...props} />;
}

export function OrgUserSelectField(props: SingleComboboxFieldProps) {
  return <SingleComboboxField placeholder="Select a church member" {...props} />;
}
