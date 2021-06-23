const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const os = require('os')

let CACHED_LOAD = {
  expires: -1,
  load: [0, 0, 0]
}
function getSystemLoad() {
  if (CACHED_LOAD.expires < Date.now()) {
    CACHED_LOAD = {
      expires: Date.now() + 10 * 1000,
      load: os.loadavg()
    }
  }
  return CACHED_LOAD.load
}

const ONE_MB = 1024 * 1024

function emitPdfStats(stats, timings) {
  if (timings['compute-pdf-caching']) {
    emitPdfCachingStats(stats, timings)
  } else {
    // How much bandwidth will the pdf incur when downloaded in full?
    Metrics.summary('pdf-bandwidth', stats['pdf-size'])
  }
}

function emitPdfCachingStats(stats, timings) {
  if (!stats['pdf-size']) return // double check

  // How large is the overhead of hashing up-front?
  const fraction =
    timings.compileE2E - timings['compute-pdf-caching'] !== 0
      ? timings.compileE2E /
        (timings.compileE2E - timings['compute-pdf-caching'])
      : 1
  if (fraction > 1.5) {
    logger.warn(
      {
        stats,
        timings,
        load: getSystemLoad()
      },
      'slow pdf caching'
    )
  }
  Metrics.summary('overhead-compute-pdf-ranges', fraction * 100 - 100)

  // How does the hashing scale to pdf size in MB?
  Metrics.timing(
    'compute-pdf-caching-relative-to-pdf-size',
    timings['compute-pdf-caching'] / (stats['pdf-size'] / ONE_MB)
  )
  if (stats['pdf-caching-total-ranges-size']) {
    // How does the hashing scale to total ranges size in MB?
    Metrics.timing(
      'compute-pdf-caching-relative-to-total-ranges-size',
      timings['compute-pdf-caching'] /
        (stats['pdf-caching-total-ranges-size'] / ONE_MB)
    )
    // How fast is the hashing per range on average?
    Metrics.timing(
      'compute-pdf-caching-relative-to-ranges-count',
      timings['compute-pdf-caching'] / stats['pdf-caching-n-ranges']
    )

    // How many ranges are new?
    Metrics.summary(
      'new-pdf-ranges-relative-to-total-ranges',
      (stats['pdf-caching-n-new-ranges'] / stats['pdf-caching-n-ranges']) * 100
    )
  }

  // How much content is cacheable?
  Metrics.summary(
    'cacheable-ranges-to-pdf-size',
    (stats['pdf-caching-total-ranges-size'] / stats['pdf-size']) * 100
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
    100 - (sizeWhenDownloadedInFull / stats['pdf-size']) * 100
  )

  // How much bandwidth will the pdf incur when downloaded in full?
  Metrics.summary('pdf-bandwidth', sizeWhenDownloadedInFull)

  // How much space do the ranges use?
  // This will accumulate the ranges size over time, skipping already written ranges.
  Metrics.summary(
    'pdf-ranges-disk-size',
    stats['pdf-caching-new-ranges-size'] - stats['pdf-caching-reclaimed-space']
  )
}

module.exports = {
  emitPdfStats
}
