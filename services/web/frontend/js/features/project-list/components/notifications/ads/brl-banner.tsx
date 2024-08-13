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

export default function BRLBanner() {
  const { t } = useTranslation()
  const [dismissedUntil, setDismissedUntil] = usePersistedState<
    Date | undefined
  >(`has_dismissed_brl_banner_until`)
  const viewEventSent = useRef<boolean>(false)

  const [showModal, setShowModal] = useState(true)

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
        country: 'BR',
      })
      viewEventSent.current = true
    }
  }, [dismissedUntil])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'dashboard-modal',
      name: 'geo-pricing',
      page: '/project',
      content: 'modal',
      country: 'BR',
      type: 'click',
    })

    setShowModal(false)

    window.open('/user/subscription/plans')
  }, [])

  const bannerDismissed = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      location: 'dashboard-modal',
      name: 'geo-pricing',
      page: '/project',
      content: 'modal',
      country: 'BR',
    })
    const until = new Date()
    until.setDate(until.getDate() + 30) // 30 days
    setDismissedUntil(until)
  }, [setDismissedUntil])

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
      country: 'BR',
      type: 'pause',
    })
    setShowModal(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntil(until)
  }, [setDismissedUntil])

  if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
    return null
  }

  return (
    <OLModal show={showModal} onHide={handleHide}>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('latam_discount_modal_title')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          <img
            alt={t('latam_discount_modal_title')}
            src="/img/subscriptions/blr-discount-modal.png"
            style={{
              width: '100%',
            }}
          />
        </p>
        <p>
          {t('latam_discount_modal_info', {
            discount: '50',
            currencyName: 'Brazilian Reais',
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
