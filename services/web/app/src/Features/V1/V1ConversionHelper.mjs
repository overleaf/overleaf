import Settings from '@overleaf/settings'

/**
 * @param {URL} url
 * @return {boolean}
 */
export function isTrustedConversionJobUrl(url) {
  if (!Settings.v1ConversionJobAllowedHosts.includes(url.host)) return false
  return Settings.v1ConversionJobAllowedPathPrefixes.some(prefix =>
    url.pathname.startsWith(prefix)
  )
}
