import getMeta from '@/utils/meta'

function loadGA() {
  if (window.olLoadGA) {
    window.olLoadGA()
  }
}

function setConsent(value) {
  document.querySelector('.cookie-banner').classList.add('hidden')
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

if (
  getMeta('ol-ExposedSettings').gaToken ||
  getMeta('ol-ExposedSettings').gaTokenV4
) {
  document
    .querySelectorAll('[data-ol-cookie-banner-set-consent]')
    .forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault()
        const consentType = el.getAttribute('data-ol-cookie-banner-set-consent')
        setConsent(consentType)
      })
    })

  const oaCookie = document.cookie.split('; ').find(c => c.startsWith('oa='))
  if (!oaCookie) {
    const cookieBannerEl = document.querySelector('.cookie-banner')
    if (cookieBannerEl) {
      cookieBannerEl.classList.remove('hidden')
    }
  }
}
