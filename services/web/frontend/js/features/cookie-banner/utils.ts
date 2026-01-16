import getMeta from '@/utils/meta'

export type CookieConsentValue = 'all' | 'essential'

function loadGA() {
  if (window.olLoadGA) {
    window.olLoadGA()
  }
}

export function setConsent(value: CookieConsentValue | null) {
  const cookieDomain = getMeta('ol-ExposedSettings').cookieDomain
  const oneYearInSeconds = 60 * 60 * 24 * 365
  const cookieAttributes =
    '; path=/' +
    '; domain=' +
    cookieDomain +
    '; max-age=' +
    oneYearInSeconds +
    '; SameSite=Lax; Secure'
  if (value === 'all') {
    document.cookie = 'oa=1' + cookieAttributes
    loadGA()
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: true }))
  } else {
    document.cookie = 'oa=0' + cookieAttributes
    window.dispatchEvent(new CustomEvent('cookie-consent', { detail: false }))
  }
}

export function cookieBannerRequired() {
  const exposedSettings = getMeta('ol-ExposedSettings')
  return Boolean(
    exposedSettings.gaToken ||
    exposedSettings.gaTokenV4 ||
    exposedSettings.propensityId ||
    exposedSettings.hotjarId
  )
}

export function hasMadeCookieChoice() {
  return document.cookie.split('; ').some(c => c.startsWith('oa='))
}
