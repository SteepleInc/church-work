type TailLogEvent = {
  scriptName?: string | null;
  outcome?: string | null;
  eventTimestamp?: number | null;
  event?: {
    request?: {
      url?: string | null;
      method?: string | null;
      headers?: Record<string, string> | null;
      cf?: { colo?: string | null } | null;
    } | null;
  } | null;
  logs?: Array<{
    level?: string | null;
    message?: unknown[];
    timestamp?: number | null;
  }> | null;
  exceptions?: Array<{
    name?: string | null;
    message?: string | null;
    timestamp?: number | null;
  }> | null;
  diagnosticsChannelEvents?: Array<{
    channel?: string | null;
    message?: unknown;
    timestamp?: number | null;
  }> | null;
};

type TailRequestInfo = NonNullable<NonNullable<TailLogEvent["event"]>["request"]>;

function hasRequest(value: unknown): value is { request?: TailRequestInfo | null } {
  return typeof value === "object" && value !== null && "request" in value;
}

function summarizeEvent(event: TraceItem) {
  const request = hasRequest(event.event) ? event.event.request : undefined;
  return {
    service: event.scriptName ?? "unknown-worker",
    outcome: event.outcome ?? "unknown",
    timestamp: event.eventTimestamp ?? Date.now(),
    request: request
      ? {
          method: request.method,
          url: request.url,
          colo: request.cf?.colo,
          rayId: request.headers?.["cf-ray"],
        }
      : undefined,
    logs: event.logs ?? [],
    exceptions: event.exceptions ?? [],
    diagnosticsChannelEvents: event.diagnosticsChannelEvents ?? [],
  };
}

export default {
  async tail(events) {
    const summaries = events.map(summarizeEvent);

    for (const summary of summaries) {
      if (summary.exceptions.length > 0 || summary.outcome === "exception") {
        console.error("producer worker exception", summary);
        continue;
      }

      console.log("producer worker invocation", summary);
    }
  },
} satisfies ExportedHandler;
