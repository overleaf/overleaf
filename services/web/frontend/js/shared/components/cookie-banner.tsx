import OLButton from '@/shared/components/ol/ol-button'
import { Trans, useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import {
  CookieConsentValue,
  cookieBannerRequired,
  hasMadeCookieChoice,
  setConsent,
} from '@/features/cookie-banner/utils'

function CookieBanner() {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(
    () => !cookieBannerRequired() || hasMadeCookieChoice()
  )

  function makeCookieChoice(value: CookieConsentValue) {
    setConsent(value)
    setHidden(true)
  }

  if (hidden) {
    return null
  }

  return (
    <section
      className="cookie-banner hidden-print"
      aria-label={t('cookie_banner')}
    >
      <div className="cookie-banner-content">
        <Trans
          i18nKey="cookie_banner_info"
          // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
          components={[<a href="/legal#Cookies" />]}
        />
      </div>
      <div className="cookie-banner-actions">
        <OLButton
          variant="link"
          size="sm"
          onClick={() => makeCookieChoice('essential')}
        >
          {t('essential_cookies_only')}
        </OLButton>
        <OLButton
          variant="primary"
          size="sm"
          onClick={() => makeCookieChoice('all')}
        >
          {t('accept_all_cookies')}
        </OLButton>
      </div>
    </section>
  )
}

export default CookieBanner
