import { atomWithStorage } from "jotai/utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Read a cookie value by name (client-side only). Returns undefined on the
 * server (no `document`) or when the cookie is absent.
 */
function getCookie(key: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${key}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift();
  }
  return undefined;
}

/** Write a cookie value (client-side only). */
function setCookie(key: string, value: string, maxAge: number = COOKIE_MAX_AGE): void {
  if (typeof document !== "undefined") {
    document.cookie = `${key}=${value}; path=/; max-age=${maxAge}`;
  }
}

/** Delete a cookie (client-side only). */
function deleteCookie(key: string): void {
  if (typeof document !== "undefined") {
    document.cookie = `${key}=; path=/; max-age=0`;
  }
}

function serialize<T>(value: T): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function deserialize(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
    return value;
  }
}

/**
 * Create a Jotai atom that syncs with a browser cookie, mirroring the
 * `atomWithStorage` API but backed by cookies instead of localStorage.
 *
 * The atom reads the cookie synchronously on the client at initialization
 * (no flash on reload), falls back to `initialValue`, and writes the cookie on
 * every update. Cookie storage is preferred over localStorage for presentation
 * preferences that should be readable during SSR.
 */
export function atomWithCookie<T>(key: string, initialValue: T, maxAge: number = COOKIE_MAX_AGE) {
  const getInitialValue = (): T => {
    const cookieValue = getCookie(key);
    if (cookieValue === undefined) {
      return initialValue;
    }
    return deserialize(cookieValue) as T;
  };

  return atomWithStorage<T>(key, getInitialValue(), {
    getItem: (storageKey: string, defaultValue: T): T => {
      const cookieValue = getCookie(storageKey);
      if (cookieValue === undefined) {
        return defaultValue;
      }
      return deserialize(cookieValue) as T;
    },
    removeItem: (storageKey: string): void => {
      deleteCookie(storageKey);
    },
    setItem: (storageKey: string, value: T): void => {
      setCookie(storageKey, serialize(value), maxAge);
    },
  });
}
