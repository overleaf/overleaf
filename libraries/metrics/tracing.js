let tracer

function tracingEnabled() {
  return process.env.GCP_OPENTELEMETRY || process.env.JAEGER_OPENTELEMETRY
}

function initialize(appName) {
  const opentelemetry = require('@opentelemetry/sdk-node')
  const {
    getNodeAutoInstrumentations,
  } = require('@opentelemetry/auto-instrumentations-node')
  const {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
    trace,
  } = require('@opentelemetry/api')
  const {
    OTLPTraceExporter,
  } = require('@opentelemetry/exporter-trace-otlp-http')
  const { Resource } = require('@opentelemetry/resources')
  const {
    SemanticResourceAttributes,
  } = require('@opentelemetry/semantic-conventions')
  const GCP = require('@google-cloud/opentelemetry-cloud-trace-exporter')

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: appName,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'Overleaf',
    'host.type': 'VM',
  })

  let exporter
  if (process.env.GCP_OPENTELEMETRY) {
    exporter = new GCP.TraceExporter()
  } else if (process.env.JAEGER_OPENTELEMETRY) {
    exporter = new OTLPTraceExporter({
      url: `http://${process.env.JAEGER_HOST || 'jaeger'}:4318/v1/traces`,
    })
  } else {
    return
  }

  const sdk = new opentelemetry.NodeSDK({
    traceExporter: exporter,
    logger: console,

    instrumentations: [getNodeAutoInstrumentations()],
    resource,
  })

  tracer = trace.getTracer(appName)
  sdk.start()
}

function getTracer() {
  return tracer
}

module.exports = { initialize, getTracer, tracingEnabled }
