import getMeta from '../../../utils/meta'
import { debugConsole } from '@/utils/debugging'

const hasTextEncoder = typeof TextEncoder !== 'undefined'
if (!hasTextEncoder) {
  debugConsole.warn('TextEncoder is not available. Disabling pdf-caching.')
}

const isOpera =
  // userAgentData is experimental and not currently in the Navigator type
  Array.isArray((navigator as any).userAgentData?.brands) &&
  (navigator as any).userAgentData.brands.some(
    (b: { brand: string }) => b.brand === 'Opera'
  )
if (isOpera) {
  debugConsole.warn('Browser cache is limited in Opera. Disabling pdf-caching.')
}

function isFlagEnabled(flag: string): boolean {
  if (!hasTextEncoder) return false
  if (isOpera) return false
  return getMeta('ol-splitTestVariants')?.[flag] === 'enabled'
}

export const cachedUrlLookupEnabled = isFlagEnabled(
  'pdf-caching-cached-url-lookup'
)
export const prefetchingEnabled = isFlagEnabled('pdf-caching-prefetching')
export const prefetchLargeEnabled = isFlagEnabled('pdf-caching-prefetch-large')
export const enablePdfCaching = isFlagEnabled('pdf-caching-mode')
export const trackPdfDownloadEnabled = isFlagEnabled('track-pdf-download')
export const canUseClsiCache = getMeta('ol-canUseClsiCache')
