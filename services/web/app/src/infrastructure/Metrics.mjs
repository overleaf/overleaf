// @ts-check

import Metrics from '@overleaf/metrics'

const analyticsQueue = new Metrics.prom.Counter({
  name: 'analytics_queue',
  help: 'Number of events sent to the analytics queue',
  labelNames: ['status', 'event_type'],
})

const revertFileDurationSeconds = new Metrics.prom.Histogram({
  name: 'timer_revert_file_duration_seconds',
  help: 'Duration of the file restore operation',
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  labelNames: ['type'],
})

const revertProjectDurationSeconds = new Metrics.prom.Histogram({
  name: 'timer_revert_project_duration_seconds',
  help: 'Duration of the project restore operation',
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 900, 1800],
})

export default {
  analyticsQueue,
  revertFileDurationSeconds,
  revertProjectDurationSeconds,
}
