const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const os = require('node:os')

let CACHED_LOAD = {
  expires: -1,
  load: [0, 0, 0],
}
function getSystemLoad() {
  if (CACHED_LOAD.expires < Date.now()) {
    CACHED_LOAD = {
      expires: Date.now() + 10 * 1000,
      load: os.loadavg(),
    }
  }
  return CACHED_LOAD.load
}

const ONE_MB = 1024 * 1024

function emitPdfStats(stats, timings, request) {
  if (timings['compute-pdf-caching']) {
    emitPdfCachingStats(stats, timings, request)
  } else {
    // How much bandwidth will the pdf incur when downloaded in full?
    Metrics.summary('pdf-bandwidth', stats['pdf-size'], request.metricsOpts)
  }
}

function emitPdfCachingStats(stats, timings, request) {
  if (!stats['pdf-size']) return // double check

  if (stats['pdf-caching-timed-out']) {
    Metrics.inc('pdf-caching-timed-out', 1, request.metricsOpts)
  }
  if (timings['pdf-caching-overhead-delete-stale-hashes'] !== undefined) {
    Metrics.summary(
      'pdf-caching-overhead-delete-stale-hashes',
      timings['pdf-caching-overhead-delete-stale-hashes'],
      request.metricsOpts
    )
  }

  // How much extra time did we spent in PDF.js?
  Metrics.timing(
    'compute-pdf-caching',
    timings['compute-pdf-caching'],
    1,
    request.metricsOpts
  )

  // How large is the overhead of hashing up-front?
  const fraction =
    timings.compileE2E - timings['compute-pdf-caching'] !== 0
      ? timings.compileE2E /
        (timings.compileE2E - timings['compute-pdf-caching'])
      : 1
  if (fraction > 1.5 && timings.compileE2E > 10 * 1000) {
    logger.warn(
      {
        stats,
        timings,
        load: getSystemLoad(),
      },
      'slow pdf caching'
    )
  }
  Metrics.summary(
    'overhead-compute-pdf-ranges',
    fraction * 100 - 100,
    request.metricsOpts
  )

  // How does the hashing scale to pdf size in MB?
  Metrics.timing(
    'compute-pdf-caching-relative-to-pdf-size',
    timings['compute-pdf-caching'] / (stats['pdf-size'] / ONE_MB),
    1,
    request.metricsOpts
  )
  if (stats['pdf-caching-total-ranges-size']) {
    // How does the hashing scale to total ranges size in MB?
    Metrics.timing(
      'compute-pdf-caching-relative-to-total-ranges-size',
      timings['compute-pdf-caching'] /
        (stats['pdf-caching-total-ranges-size'] / ONE_MB),
      1,
      request.metricsOpts
    )
    // How fast is the hashing per range on average?
    Metrics.timing(
      'compute-pdf-caching-relative-to-ranges-count',
      timings['compute-pdf-caching'] / stats['pdf-caching-n-ranges'],
      1,
      request.metricsOpts
    )

    // How many ranges are new?
    Metrics.summary(
      'new-pdf-ranges-relative-to-total-ranges',
      (stats['pdf-caching-n-new-ranges'] / stats['pdf-caching-n-ranges']) * 100,
      request.metricsOpts
    )
  }

  // How much content is cacheable?
  Metrics.summary(
    'cacheable-ranges-to-pdf-size',
    (stats['pdf-caching-total-ranges-size'] / stats['pdf-size']) * 100,
    request.metricsOpts
  )

  const sizeWhenDownloadedInFull =
    // All of the pdf
    stats['pdf-size'] -
    // These ranges are potentially cached.
    stats['pdf-caching-total-ranges-size'] +
    // These ranges are not cached.
    stats['pdf-caching-new-ranges-size']

  // How much bandwidth can we save when downloading the pdf in full?
  Metrics.summary(
    'pdf-bandwidth-savings',
    100 - (sizeWhenDownloadedInFull / stats['pdf-size']) * 100,
    request.metricsOpts
  )

  // How much bandwidth will the pdf incur when downloaded in full?
  Metrics.summary(
    'pdf-bandwidth',
    sizeWhenDownloadedInFull,
    request.metricsOpts
  )

  // How much space do the ranges use?
  // This will accumulate the ranges size over time, skipping already written ranges.
  Metrics.summary(
    'pdf-ranges-disk-size',
    stats['pdf-caching-new-ranges-size'] - stats['pdf-caching-reclaimed-space'],
    request.metricsOpts
  )
}

module.exports = {
  emitPdfStats,
}
