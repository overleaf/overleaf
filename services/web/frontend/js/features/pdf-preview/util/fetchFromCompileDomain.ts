import { isNetworkError } from '../../../utils/isNetworkError'
import getMeta from '../../../utils/meta'
import OError from '@overleaf/o-error'
import { postJSON } from '../../../infrastructure/fetch-json'

let useFallbackDomainUntil = performance.now()
const ONE_HOUR_IN_MS = 1000 * 60 * 60

export async function fetchFromCompileDomain(url: string, init: RequestInit) {
  const userContentDomain = getMeta('ol-compilesUserContentDomain')
  let isUserContentDomain =
    userContentDomain &&
    new URL(url).hostname === new URL(userContentDomain).hostname

  if (useFallbackDomainUntil > performance.now()) {
    isUserContentDomain = false
    url = withFallbackCompileDomain(url)
  }
  try {
    return await fetch(url, init)
  } catch (err) {
    if (isNetworkError(err) && isUserContentDomain) {
      try {
        const res = await fetch(withFallbackCompileDomain(url), init)
        // Only switch to the fallback when fetch does not throw there as well.
        if (useFallbackDomainUntil < performance.now()) {
          useFallbackDomainUntil = performance.now() + ONE_HOUR_IN_MS
          recordFallbackUsage()
        }
        return res
      } catch (err2: any) {
        throw OError.tag(err2, 'fallback request failed', {
          errUserContentDomain: err,
        })
      }
    }
    throw err
  }
}

export function swapDomain(url: string, domain: string) {
  const u = new URL(url)
  u.hostname = new URL(domain).hostname
  return u.href
}

function withFallbackCompileDomain(url: string) {
  return swapDomain(url, getMeta('ol-fallbackCompileDomain'))
}

function recordFallbackUsage() {
  setTimeout(() => {
    postJSON('/record-user-content-domain-fallback-usage').catch(() => {})
  }, 1_000)
}
