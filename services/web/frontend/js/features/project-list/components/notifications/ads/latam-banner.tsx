import { useCallback, useEffect, useRef, useState } from 'react'
import mxnBannerImage from '../../../images/mxn-banner.png'
import copBannerImage from '../../../images/cop-banner.png'
import clpBannerImage from '../../../images/clp-banner.png'
import penBannerImage from '../../../images/pen-banner.png'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'

const LATAM_CURRENCIES = {
  MXN: {
    name: 'Mexican Pesos',
    countryCode: 'MX',
    discountCode: '25',
    imageSource: mxnBannerImage,
  },
  COP: {
    name: 'Colombian Pesos',
    countryCode: 'CO',
    discountCode: '60',
    imageSource: copBannerImage,
  },
  CLP: {
    name: 'Chilean Pesos',
    countryCode: 'CL',
    discountCode: '30',
    imageSource: clpBannerImage,
  },
  PEN: {
    name: 'Peruvian Soles',
    countryCode: 'PE',
    discountCode: '40',
    imageSource: penBannerImage,
  },
}

export default function LATAMBanner() {
  const { t } = useTranslation()
  const [dismissedUntil, setDismissedUntil] = usePersistedState<
    Date | undefined
  >(`has_dismissed_latam_banner_until`)
  const viewEventSent = useRef<boolean>(false)
  const [showModal, setShowModal] = useState(true)

  const currency = getMeta('ol-recommendedCurrency')
  const {
    imageSource,
    name: currencyName,
    discountCode,
    countryCode,
  } = LATAM_CURRENCIES[currency as keyof typeof LATAM_CURRENCIES]

  useEffect(() => {
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      return
    }
    if (!viewEventSent.current) {
      eventTracking.sendMB('promo-prompt', {
        location: 'dashboard-modal',
        name: 'geo-pricing',
        page: '/project',
        content: 'modal',
        country: countryCode,
      })
      viewEventSent.current = true
    }
  }, [dismissedUntil, countryCode])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'dashboard-modal',
      name: 'geo-pricing',
      page: '/project',
      content: 'modal',
      country: countryCode,
      type: 'click',
    })

    setShowModal(false)

    window.open('/user/subscription/plans')
  }, [countryCode])

  const bannerDismissed = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      location: 'dashboard-modal',
      name: 'geo-pricing',
      page: '/project',
      content: 'modal',
      country: countryCode,
    })
    const until = new Date()
    until.setDate(until.getDate() + 30) // 30 days
    setDismissedUntil(until)
  }, [setDismissedUntil, countryCode])

  const handleHide = useCallback(() => {
    setShowModal(false)
    bannerDismissed()
  }, [bannerDismissed])

  const handleMaybeLater = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'dashboard-modal',
      name: 'geo-pricing',
      page: '/project',
      content: 'modal',
      country: countryCode,
      type: 'pause',
    })
    setShowModal(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntil(until)
  }, [setDismissedUntil, countryCode])

  if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
    return null
  }

  // Safety, but should always be a valid LATAM currency if ol-showLATAMBanner is true
  if (!(currency in LATAM_CURRENCIES)) {
    return null
  }

  return (
    <OLModal show={showModal} onHide={handleHide} backdrop="static">
      <OLModalHeader>
        <OLModalTitle>{t('latam_discount_modal_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          <img
            alt={t('latam_discount_modal_title')}
            src={imageSource}
            style={{
              width: '100%',
            }}
          />
        </p>
        <p>
          {t('latam_discount_modal_info', {
            discount: discountCode,
            currencyName,
          })}
        </p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={handleMaybeLater}>
          {t('maybe_later')}
        </OLButton>
        <OLButton variant="primary" onClick={handleClick}>
          {t('get_discounted_plan')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
