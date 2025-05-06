/* eslint-disable no-console */

/**
 * This module initializes the metrics module. It should be imported once
 * before any other module to support code instrumentation.
 */

const metricsModuleImportStartTime = performance.now()

const APP_NAME = process.env.METRICS_APP_NAME || 'unknown'
const BUILD_VERSION = process.env.BUILD_VERSION
const ENABLE_PROFILE_AGENT = process.env.ENABLE_PROFILE_AGENT === 'true'
const GCP_OPENTELEMETRY = process.env.GCP_OPENTELEMETRY === 'true'
const JAEGER_OPENTELEMETRY = process.env.JAEGER_OPENTELEMETRY === 'true'

console.log('Initializing metrics')

if (GCP_OPENTELEMETRY || JAEGER_OPENTELEMETRY) {
  initializeOpenTelemetryInstrumentation()
  initializeOpenTelemetryLogging()
}

if (ENABLE_PROFILE_AGENT) {
  initializeProfileAgent()
}

initializePrometheus()
initializePromWrapper()
recordProcessStart()

function initializeOpenTelemetryInstrumentation() {
  console.log('Starting OpenTelemetry instrumentation')
  const opentelemetry = require('@opentelemetry/sdk-node')
  const {
    getNodeAutoInstrumentations,
  } = require('@opentelemetry/auto-instrumentations-node')
  const { Resource } = require('@opentelemetry/resources')
  const {
    SemanticResourceAttributes,
  } = require('@opentelemetry/semantic-conventions')

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: APP_NAME,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'Overleaf',
    'host.type': 'VM',
  })

  let exporter
  if (GCP_OPENTELEMETRY) {
    const GCP = require('@google-cloud/opentelemetry-cloud-trace-exporter')
    exporter = new GCP.TraceExporter()
  } else if (JAEGER_OPENTELEMETRY) {
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-http')
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
  sdk.start()
}

function initializeOpenTelemetryLogging() {
  const {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
  } = require('@opentelemetry/api')
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)
}

function initializeProfileAgent() {
  console.log('Starting Google Profile Agent')
  const profiler = require('@google-cloud/profiler')
  profiler.start({
    serviceContext: {
      service: APP_NAME,
      version: BUILD_VERSION,
    },
  })
}

function initializePrometheus() {
  const os = require('node:os')
  const promClient = require('prom-client')
  promClient.register.setDefaultLabels({ app: APP_NAME, host: os.hostname() })
  promClient.collectDefaultMetrics({ timeout: 5000, prefix: '' })
}

function initializePromWrapper() {
  const promWrapper = require('./prom_wrapper')
  promWrapper.setupSweeping()
}

function recordProcessStart() {
  const metrics = require('.')
  metrics.inc('process_startup')
}

module.exports = { metricsModuleImportStartTime }
