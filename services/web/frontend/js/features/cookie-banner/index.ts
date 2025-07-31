import {
  CookieConsentValue,
  cookieBannerRequired,
  hasMadeCookieChoice,
  setConsent,
} from '@/features/cookie-banner/utils'

function toggleCookieBanner(hidden: boolean) {
  const cookieBannerEl = document.querySelector('.cookie-banner')
  if (cookieBannerEl) {
    cookieBannerEl.classList.toggle('hidden', hidden)
  }
}

if (cookieBannerRequired()) {
  document
    .querySelectorAll('[data-ol-cookie-banner-set-consent]')
    .forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault()
        toggleCookieBanner(true)
        const consentType = el.getAttribute(
          'data-ol-cookie-banner-set-consent'
        ) as CookieConsentValue | null
        setConsent(consentType)
      })
    })

  if (!hasMadeCookieChoice()) {
    toggleCookieBanner(false)
  }
}
