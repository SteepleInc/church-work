export function isValidChurchTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
