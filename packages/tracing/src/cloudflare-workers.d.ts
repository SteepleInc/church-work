/**
 * Minimal declaration for the workerd built-in tracing module so the worker
 * entry can statically import it without pulling full Cloudflare types into
 * this shared package. Apps that deploy to Workers own the full generated
 * types; this declaration never enters their TS programs because tsc does not
 * resolve the `workerd` export condition.
 */
declare module "cloudflare:workers" {
  namespace tracing {
    function enterSpan<T, A extends ReadonlyArray<unknown>>(
      name: string,
      callback: (span: Span, ...args: A) => T,
      ...args: A
    ): T;
  }

  class Span {
    readonly isTraced: boolean;
    setAttribute(key: string, value: string | number | boolean | undefined): void;
  }
}
