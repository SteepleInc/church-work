# App Administrator role via Better Auth admin plugin

App Administration (the cross-Church `/admin` surface that lists every Church and User and supports impersonation) is authorized by an application-level admin role, not by a User's per-Church Membership Role. We adopt Better Auth's `admin()` plugin server-side (`authCore.ts`) and `adminClient()` client-side, add the plugin's `role`/`banned`/`banReason`/`banExpires` fields to the local-install `user` table and `impersonatedBy` to the `session` table, and gate every cross-tenant Convex query (`listAllOrgs`, `listAllUsers`) and impersonation on `user.role === "admin"` server-side.

## Considered Options

- **Keep the existing per-Church owner/admin gate** (`canAccessInternalNavigation`). Rejected: it lets any Church owner/admin read every other Church's data — privilege escalation across tenants — and cannot authorize impersonation.
- **Env/config allow-list of admin user IDs.** Rejected: requires hand-rolling impersonation and manual list maintenance; the admin plugin gives both for free and matches PreachX.

## Consequences

- The local-install Better Auth schema is augmented with admin-plugin fields; this is a deliberate edit to auth-component-managed tables.
- The client `InternalAccessGate` must switch from checking Church Membership Role to checking App Administrator status; existing owners/admins lose access to `/admin` unless granted the app `admin` role.
