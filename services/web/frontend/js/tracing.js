import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esnext'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'

import getMeta from './utils/meta'

if (getMeta('ol-useOpenTelemetry')) {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'frontend',
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'Overleaf',
  })

  const provider = new WebTracerProvider({ resource })

  provider.addSpanProcessor(
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: `https://${window.location.hostname}/otlp/v1/traces`,
      })
    )
  )

  provider.register({
    // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
    contextManager: new ZoneContextManager(),
  })

  // Registering instrumentations
  registerInstrumentations({
    instrumentations: [getWebAutoInstrumentations()],
  })
}
