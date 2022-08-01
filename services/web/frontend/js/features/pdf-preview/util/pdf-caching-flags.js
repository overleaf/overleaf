import getMeta from '../../../utils/meta'

const hasTextEncoder = typeof TextEncoder !== 'undefined'
if (!hasTextEncoder) {
  console.warn('TextEncoder is not available. Disabling pdf-caching.')
}

function isFlagEnabled(flag) {
  if (!hasTextEncoder) return false
  return getMeta('ol-splitTestVariants')?.[flag] === 'enabled'
}

export const cachedUrlLookupEnabled = isFlagEnabled(
  'pdf-caching-cached-url-lookup'
)
export const prefetchingEnabled = isFlagEnabled('pdf-caching-prefetching')
export const prefetchLargeEnabled = isFlagEnabled('pdf-caching-prefetch-large')
export const enablePdfCaching = isFlagEnabled('pdf-caching-mode')
export const trackPdfDownloadEnabled = isFlagEnabled('track-pdf-download')
