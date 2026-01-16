const { prom } = require('@overleaf/metrics')

const COMPILE_TIME_BUCKETS = [
  0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150,
  180, 210, 240,
]

const compilesTotal = new prom.Counter({
  name: 'clsi_compiles_total',
  help: 'Number of compiles',
  labelNames: [
    'status',
    'engine',
    'compile',
    'group',
    'image',
    'draft',
    'stop_on_first_error',
    'passes',
  ],
})

const compileDurationSeconds = new prom.Histogram({
  name: 'clsi_compile_duration_seconds',
  help: 'Duration of the latexmkrc invocation',
  buckets: COMPILE_TIME_BUCKETS,
  labelNames: ['status', 'engine', 'compile', 'group', 'passes'],
})

const e2eCompileDurationSeconds = new prom.Histogram({
  name: 'clsi_e2e_compile_duration_seconds',
  help: 'Duration of the entire compile request in clsi (sync, latexmk, output)',
  buckets: COMPILE_TIME_BUCKETS,
  labelNames: ['compile', 'group'],
})

const e2eCompileDurationClsiPerfSeconds = new prom.Gauge({
  name: 'clsi_e2e_compile_duration_clsi_perf_seconds',
  help: 'Duration of the entire compile request in clsi (sync, latexmk, output) for clsi-perf',
  labelNames: ['compile', 'variant'],
})

const syncResourcesDurationSeconds = new prom.Histogram({
  name: 'clsi_sync_resources_duration_seconds',
  help: 'Time it takes to prepare files for a compile',
  buckets: [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10, 15, 30, 45, 60],
  labelNames: ['type', 'compile', 'group'],
})

const processOutputFilesDurationSeconds = new prom.Histogram({
  name: 'clsi_process_output_files_duration_seconds',
  help: 'Time it takes to process output files of a compile',
  buckets: [0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 7.5, 10],
  labelNames: ['compile', 'group'],
})

const latexmkRuleDurationSeconds = new prom.Histogram({
  name: 'clsi_latexmk_rule_duration_seconds',
  help: 'Duration of a latexmk rule execution',
  buckets: COMPILE_TIME_BUCKETS,
  labelNames: ['group', 'rule'],
})

const imageProcessingDurationSeconds = new prom.Histogram({
  name: 'clsi_image_processing_duration_seconds',
  help: 'Time spent processing images',
  buckets: COMPILE_TIME_BUCKETS,
  labelNames: ['group', 'type'],
})

function shouldSkipMetrics(request) {
  return ['clsi-perf', 'health-check', 'clsi-cache-template'].includes(
    request.metricsOpts.path
  )
}

module.exports = {
  compilesTotal,
  compileDurationSeconds,
  e2eCompileDurationSeconds,
  e2eCompileDurationClsiPerfSeconds,
  syncResourcesDurationSeconds,
  processOutputFilesDurationSeconds,
  latexmkRuleDurationSeconds,
  imageProcessingDurationSeconds,
  shouldSkipMetrics,
}
