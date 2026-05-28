# Initial application architecture

Church Task uses a Bun + Turborepo monorepo with a Vite React app, TanStack Router for frontend routing, Convex as the backend, Better Auth through Convex for authentication, Confect for typed Convex integration, and Effect for type-safe application logic. We are not using TanStack Start because Convex is responsible for backend behavior, and we will avoid separate background-job infrastructure unless the domain requires it.
