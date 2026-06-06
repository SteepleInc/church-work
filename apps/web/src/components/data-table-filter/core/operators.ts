export const textFilterOperators = ["contains", "does not contain"] as const;
export const numberFilterOperators = [
  "is",
  "is not",
  "is less than",
  "is greater than or equal to",
  "is greater than",
  "is less than or equal to",
  "is between",
  "is not between",
] as const;
export const dateFilterOperators = [
  "is",
  "is not",
  "is before",
  "is on or after",
  "is after",
  "is on or before",
  "is between",
  "is not between",
] as const;
export const optionFilterOperators = ["is", "is not", "is any of", "is none of"] as const;
export const multiOptionFilterOperators = [
  "include",
  "exclude",
  "include any of",
  "include all of",
  "exclude if any of",
  "exclude if all",
] as const;
