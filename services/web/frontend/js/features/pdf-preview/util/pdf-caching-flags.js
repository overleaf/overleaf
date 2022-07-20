import getMeta from '../../../utils/meta'

function isFlagEnabled(flag) {
  return getMeta('ol-splitTestVariants')?.[flag] === 'enabled'
}

export const enablePdfCaching = isFlagEnabled('pdf-caching-mode')
export const trackPdfDownloadEnabled = isFlagEnabled('track-pdf-download')
