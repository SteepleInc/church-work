const SUPERLOG_ENDPOINT = "https://intake.superlog.sh";
const SUPERLOG_PUBLIC_TOKEN = "sl_public_OdVj7dNN03cJD61UF4Oi2BPTrl2feOXQ33n5XAI97MA";

function superlogHeaders(token: string): Record<string, string> {
  return { "x-api-key": token };
}

const resourceAttributes = [
  { key: "service.name", value: { stringValue: "church-task.backend" } },
  { key: "service.version", value: { stringValue: "1.0.0" } },
  { key: "deployment.environment.name", value: { stringValue: "convex" } },
  {
    key: "vcs.repository.url.full",
    value: { stringValue: "https://github.com/SteepleInc/church-task" },
  },
];

type TelemetryAttributes = Record<string, string | number | boolean | null | undefined>;

const stringAttribute = (key: string, value: string | number | boolean | null | undefined) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return { key, value: { doubleValue: value } };
  if (typeof value === "boolean") return { key, value: { boolValue: value } };
  return { key, value: { stringValue: value } };
};

const attributes = (values: TelemetryAttributes) =>
  Object.entries(values)
    .map(([key, value]) => stringAttribute(key, value))
    .filter((value): value is NonNullable<typeof value> => value !== null);

const randomHex = (bytes: number) => {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const nowNanos = () => `${BigInt(Date.now()) * 1_000_000n}`;

const postOtlp = async (path: string, body: unknown) => {
  await fetch(`${SUPERLOG_ENDPOINT}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
    },
    body: JSON.stringify(body),
  });
};

const exportSpan = (args: {
  readonly name: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly attrs: TelemetryAttributes;
  readonly statusCode: "STATUS_CODE_OK" | "STATUS_CODE_ERROR";
}) =>
  postOtlp("/v1/traces", {
    resourceSpans: [
      {
        resource: { attributes: resourceAttributes },
        scopeSpans: [
          {
            scope: { name: "church-task.backend" },
            spans: [
              {
                traceId: args.traceId,
                spanId: args.spanId,
                name: args.name,
                kind: "SPAN_KIND_INTERNAL",
                startTimeUnixNano: args.startTimeUnixNano,
                endTimeUnixNano: args.endTimeUnixNano,
                attributes: attributes(args.attrs),
                status: { code: args.statusCode },
              },
            ],
          },
        ],
      },
    ],
  });

const exportLog = (args: {
  readonly traceId: string;
  readonly spanId: string;
  readonly severityText: "INFO" | "ERROR";
  readonly body: string;
  readonly attrs: TelemetryAttributes;
}) =>
  postOtlp("/v1/logs", {
    resourceLogs: [
      {
        resource: { attributes: resourceAttributes },
        scopeLogs: [
          {
            scope: { name: "church-task.backend" },
            logRecords: [
              {
                timeUnixNano: nowNanos(),
                traceId: args.traceId,
                spanId: args.spanId,
                severityText: args.severityText,
                body: { stringValue: args.body },
                attributes: attributes(args.attrs),
              },
            ],
          },
        ],
      },
    ],
  });

const exportMetric = (args: { readonly name: string; readonly attrs: TelemetryAttributes }) =>
  postOtlp("/v1/metrics", {
    resourceMetrics: [
      {
        resource: { attributes: resourceAttributes },
        scopeMetrics: [
          {
            scope: { name: "church-task.backend" },
            metrics: [
              {
                name: args.name,
                sum: {
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_DELTA",
                  isMonotonic: true,
                  dataPoints: [
                    {
                      timeUnixNano: nowNanos(),
                      asInt: "1",
                      attributes: attributes(args.attrs),
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  });

export const withConvexTelemetry = async <T>(
  name: string,
  attrs: TelemetryAttributes,
  operation: () => Promise<T>,
) => {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const startTimeUnixNano = nowNanos();

  try {
    const result = await operation();
    const resultAttrs = {
      ...attrs,
      outcome:
        typeof result === "object" && result !== null && "ok" in result && result.ok === false
          ? "failure"
          : "success",
    };

    await Promise.all([
      exportSpan({
        name,
        traceId,
        spanId,
        startTimeUnixNano,
        endTimeUnixNano: nowNanos(),
        attrs: resultAttrs,
        statusCode: resultAttrs.outcome === "failure" ? "STATUS_CODE_ERROR" : "STATUS_CODE_OK",
      }),
      exportLog({
        traceId,
        spanId,
        severityText: resultAttrs.outcome === "failure" ? "ERROR" : "INFO",
        body: "Convex operation completed",
        attrs: resultAttrs,
      }),
      exportMetric({ name: "convex.operations", attrs: resultAttrs }),
    ]);

    return result;
  } catch (error) {
    const errorAttrs = { ...attrs, outcome: "exception" };
    await Promise.all([
      exportSpan({
        name,
        traceId,
        spanId,
        startTimeUnixNano,
        endTimeUnixNano: nowNanos(),
        attrs: errorAttrs,
        statusCode: "STATUS_CODE_ERROR",
      }),
      exportLog({
        traceId,
        spanId,
        severityText: "ERROR",
        body: error instanceof Error ? error.message : "Convex operation failed",
        attrs: errorAttrs,
      }),
      exportMetric({ name: "convex.operations", attrs: errorAttrs }),
    ]);
    throw error;
  }
};
