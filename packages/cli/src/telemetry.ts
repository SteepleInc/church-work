import { metrics, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const SUPERLOG_ENDPOINT = "https://intake.superlog.sh";
const SUPERLOG_PUBLIC_TOKEN = "sl_public_OdVj7dNN03cJD61UF4Oi2BPTrl2feOXQ33n5XAI97MA";

function superlogHeaders(token: string): Record<string, string> {
  return { "x-api-key": token };
}

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: "church-task.cli",
  [ATTR_SERVICE_VERSION]: "0.0.0",
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? "development",
  "vcs.repository.url.full": "https://github.com/SteepleInc/church-task",
  ...(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA
    ? { "vcs.ref.head.revision": process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA }
    : {}),
});

export const telemetrySdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: `${SUPERLOG_ENDPOINT}/v1/traces`,
    headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${SUPERLOG_ENDPOINT}/v1/metrics`,
      headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
    }),
    exportIntervalMillis: 30_000,
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${SUPERLOG_ENDPOINT}/v1/logs`,
        headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
      }),
    ),
  ],
  instrumentations: [getNodeAutoInstrumentations()],
});

telemetrySdk.start();

export const cliTracer = trace.getTracer("church-task.cli");
export const cliMeter = metrics.getMeter("church-task.cli");
export const cliLogger = logs.getLogger("church-task.cli");

export const cliCommandCounter = cliMeter.createCounter("cli.commands", {
  description: "CLI command executions",
});

export const cliCommandDuration = cliMeter.createHistogram("cli.command.duration", {
  description: "CLI command duration in milliseconds",
  unit: "ms",
});

export const flushTelemetry = () => telemetrySdk.shutdown();
