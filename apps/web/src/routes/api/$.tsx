import { createFileRoute } from "@tanstack/react-router";

import { handleApiRequest } from "./-runtime";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      DELETE: ({ request }) => handleApiRequest(request),
      GET: ({ request }) => handleApiRequest(request),
      OPTIONS: ({ request }) => handleApiRequest(request),
      PATCH: ({ request }) => handleApiRequest(request),
      POST: ({ request }) => handleApiRequest(request),
      PUT: ({ request }) => handleApiRequest(request),
    },
  },
});
