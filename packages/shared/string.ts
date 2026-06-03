const irregularPlurals: Record<string, string> = {
  address: "addresses",
  child: "children",
  person: "people",
};

const irregularSingulars = Object.fromEntries(
  Object.entries(irregularPlurals).map(([singular, plural]) => [plural, singular]),
);

const preserveCase = (original: string, transformed: string) => {
  if (original === original.toUpperCase()) {
    return transformed.toUpperCase();
  }

  if (original[0] === original[0]?.toUpperCase()) {
    return `${transformed[0]?.toUpperCase() ?? ""}${transformed.slice(1).toLowerCase()}`;
  }

  return transformed.toLowerCase();
};

export function pluralize(word: string): string {
  if (!word) {
    return word;
  }

  const lower = word.toLowerCase();
  const irregular = irregularPlurals[lower];
  if (irregular) {
    return preserveCase(word, irregular);
  }

  if (word.endsWith("y") && !"aeiou".includes((word.at(-2) ?? "").toLowerCase())) {
    return `${word.slice(0, -1)}ies`;
  }

  if (/[sxz]$|[cs]h$/.test(word)) {
    return `${word}es`;
  }

  return `${word}s`;
}

export function singularize(word: string): string {
  if (!word) {
    return word;
  }

  const lower = word.toLowerCase();
  const irregular = irregularSingulars[lower];
  if (irregular) {
    return preserveCase(word, irregular);
  }

  if (word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith("es") && /[sxz]es$|[cs]hes$/.test(word)) {
    return word.slice(0, -2);
  }

  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }

  return word;
}

export const formatLabel = (fieldName: string): string =>
  fieldName
    .replaceAll(/[_-]/g, " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
