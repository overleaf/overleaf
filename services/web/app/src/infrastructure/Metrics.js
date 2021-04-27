const Metrics = require('@overleaf/metrics')

exports.analyticsQueue = new Metrics.prom.Counter({
  name: 'analytics_queue',
  help: 'Number of events sent to the analytics queue',
  labelNames: ['status', 'event_type'],
})
