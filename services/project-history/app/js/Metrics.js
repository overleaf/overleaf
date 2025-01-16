// @ts-check

import { prom } from '@overleaf/metrics'

export const historyFlushDurationSeconds = new prom.Histogram({
  name: 'history_flush_duration_seconds',
  help: 'Duration of a history flush in seconds',
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5, 10],
})

export const historyFlushQueueSize = new prom.Histogram({
  name: 'history_flush_queue_size',
  help: 'Size of the queue during history flushes',
  buckets: prom.exponentialBuckets(1, 2, 10),
})
