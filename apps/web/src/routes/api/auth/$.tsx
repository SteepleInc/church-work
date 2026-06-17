import { createFileRoute } from "@tanstack/react-router";

import { handleApiRequest } from "../-runtime";

const handleAuthRequest = (request: Request) => {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "DATABASE_URL is required to handle auth requests." },
      { status: 500 },
    );
  }

  return handleApiRequest(request);
};

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
