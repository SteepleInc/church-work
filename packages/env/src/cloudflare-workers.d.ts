/**
 * Minimal declaration for the workerd built-in module so the worker entry can
 * statically import bindings without pulling full Cloudflare types into this
 * shared package. Apps that deploy to Workers own the full generated types.
 */
declare module "cloudflare:workers" {
  export const env: NodeJS.ProcessEnv & {
    readonly HYPERDRIVE?: { readonly connectionString: string };
  };
}
