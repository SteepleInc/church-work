const INTENTIONAL_SIGN_OUT_KEY = "church-task:intentional-sign-out";

export function markIntentionalSignOut() {
  window.sessionStorage.setItem(INTENTIONAL_SIGN_OUT_KEY, "true");
}

export function isIntentionalSignOut() {
  return window.sessionStorage.getItem(INTENTIONAL_SIGN_OUT_KEY) === "true";
}

export function clearIntentionalSignOut() {
  window.sessionStorage.removeItem(INTENTIONAL_SIGN_OUT_KEY);
}
