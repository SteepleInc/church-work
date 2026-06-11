import { diag, DiagConsoleLogger, DiagLogLevel, metrics, trace } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { logs } from "@opentelemetry/api-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
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
  [ATTR_SERVICE_NAME]: "church-task.web",
  [ATTR_SERVICE_VERSION]: "0.0.0",
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: import.meta.env.MODE,
  "vcs.repository.url.full": "https://github.com/SteepleInc/church-task",
  ...(import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA
    ? { "vcs.ref.head.revision": import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA }
    : {}),
});

const traceExporter = new OTLPTraceExporter({
  url: `${SUPERLOG_ENDPOINT}/v1/traces`,
  headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
});

const tracerProvider = new WebTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(traceExporter)],
});

tracerProvider.register();

const metricExporter = new OTLPMetricExporter({
  url: `${SUPERLOG_ENDPOINT}/v1/metrics`,
  headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
});

const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 30_000 }),
  ],
});

metrics.setGlobalMeterProvider(meterProvider);

const logExporter = new OTLPLogExporter({
  url: `${SUPERLOG_ENDPOINT}/v1/logs`,
  headers: superlogHeaders(SUPERLOG_PUBLIC_TOKEN),
});

const loggerProvider = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(logExporter)],
});

logs.setGlobalLoggerProvider(loggerProvider);

registerInstrumentations({ instrumentations: [] });

const tracer = trace.getTracer("church-task.web");
const meter = metrics.getMeter("church-task.web");
const logger = logs.getLogger("church-task.web");
const startupCounter = meter.createCounter("app.startups", {
  description: "Browser application startups",
});

startupCounter.add(1, { surface: "web" });

tracer.startActiveSpan("app.bootstrap", (span) => {
  span.setAttributes({ surface: "web" });
  logger.emit({
    severityText: "INFO",
    body: "Web app telemetry initialized",
    attributes: { surface: "web" },
  });
  span.end();
});

if (import.meta.env.DEV && import.meta.env.VITE_OTEL_DEBUG === "true") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

window.addEventListener("pagehide", () => {
  void tracerProvider.forceFlush();
  void meterProvider.forceFlush();
  void loggerProvider.forceFlush();
});
