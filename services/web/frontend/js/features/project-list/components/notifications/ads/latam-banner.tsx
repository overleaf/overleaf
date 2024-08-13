import { useCallback, useEffect, useRef, useState } from 'react'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'

const LATAM_CURRENCIES = {
  MXN: {
    name: 'Mexican Pesos',
    countryCode: 'MX',
    discountCode: '25',
    imageSource: '/img/subscriptions/mexico-discount-modal.png',
  },
  COP: {
    name: 'Colombian Pesos',
    countryCode: 'CO',
    discountCode: '60',
    imageSource: '/img/subscriptions/colombia-discount-modal.png',
  },
  CLP: {
    name: 'Chilean Pesos',
    countryCode: 'CL',
    discountCode: '30',
    imageSource: '/img/subscriptions/chile-discount-modal.png',
  },
  PEN: {
    name: 'Peruvian Soles',
    countryCode: 'PE',
    discountCode: '40',
    imageSource: '/img/subscriptions/peru-discount-modal.png',
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
      <OLModalHeader closeButton>
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
