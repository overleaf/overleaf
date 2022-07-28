import getMeta from '../../../utils/meta'

const hasTextEncoder = typeof TextEncoder !== 'undefined'
if (!hasTextEncoder) {
  console.warn('TextEncoder is not available. Disabling pdf-caching.')
}

function isFlagEnabled(flag) {
  if (!hasTextEncoder) return false
  return getMeta('ol-splitTestVariants')?.[flag] === 'enabled'
}

export const enablePdfCaching = isFlagEnabled('pdf-caching-mode')
export const trackPdfDownloadEnabled = isFlagEnabled('track-pdf-download')
