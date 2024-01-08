import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import Notification from '../notification'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import { Modal, Button } from 'react-bootstrap'
import AccessibleModal from '../../../../../shared/components/accessible-modal'
import getMeta from '@/utils/meta'

interface VariantContents {
  default: string
  'green-banner': string
  modal: string
}

const contentLookup: VariantContents = {
  default: 'blue',
  'green-banner': 'green',
  modal: 'modal',
}

type INRBannerProps = {
  variant: keyof VariantContents
  splitTestName: string
}

export default function INRBanner({ variant, splitTestName }: INRBannerProps) {
  const { t } = useTranslation()
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
  const [dismissedUntil, setDismissedUntil] = usePersistedState<
    Date | undefined
  >(`has_dismissed_inr_banner_until`)
  const viewEventSent = useRef<boolean>(false)

  // Only used by 'modal' variant
  const [showModal, setShowModal] = useState(true)

  useEffect(() => {
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      return
    }
    if (!viewEventSent.current) {
      eventTracking.sendMB('promo-prompt', {
        location: variant === 'modal' ? 'dashboard-modal' : 'dashboard-banner',
        name: splitTestName,
        content: contentLookup[variant],
      })
      viewEventSent.current = true
    }
  }, [dismissedUntil, splitTestName, variant])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: variant === 'modal' ? 'dashboard-modal' : 'dashboard-banner',
      name: splitTestName,
      content: contentLookup[variant],
      type: 'click',
    })

    setShowModal(false)

    window.open('/user/subscription/plans')
  }, [splitTestName, variant])

  const bannerDismissed = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      location: variant === 'modal' ? 'dashboard-modal' : 'dashboard-banner',
      name: splitTestName,
      content: contentLookup[variant],
      type: 'click',
    })
    const until = new Date()
    until.setDate(until.getDate() + 30) // 30 days
    setDismissedUntil(until)
  }, [setDismissedUntil, splitTestName, variant])

  const handleHide = useCallback(() => {
    setShowModal(false)
    bannerDismissed()
  }, [bannerDismissed])

  const handleMaybeLater = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: variant === 'modal' ? 'dashboard-modal' : 'dashboard-banner',
      name: splitTestName,
      content: contentLookup[variant],
      type: 'pause',
    })
    setShowModal(false)
    const until = new Date()
    until.setDate(until.getDate() + 1) // 1 day
    setDismissedUntil(until)
  }, [setDismissedUntil, splitTestName, variant])

  if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
    return null
  }

  if (variant === 'default') {
    return (
      <Notification
        bsStyle="info"
        onDismiss={bannerDismissed}
        body={
          <Trans
            i18nKey="inr_discount_offer"
            components={[<b />]} // eslint-disable-line react/jsx-key
          />
        }
        action={
          <Button
            bsStyle={newNotificationStyle ? null : 'info'}
            bsSize="sm"
            className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
            onClick={handleClick}
          >
            {t('get_discounted_plan')}
          </Button>
        }
      />
    )
  } else if (variant === 'green-banner') {
    return (
      <Notification
        bsStyle="success"
        onDismiss={bannerDismissed}
        body={
          <Trans
            i18nKey="inr_discount_offer_green_banner"
            components={[<b />, <br />]} // eslint-disable-line react/jsx-key
            values={{ flag: '🇮🇳' }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
        action={
          <Button
            bsStyle={newNotificationStyle ? null : 'success'}
            bsSize="sm"
            className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
            onClick={handleClick}
          >
            {t('get_discounted_plan')} ₹
          </Button>
        }
      />
    )
  } else if (variant === 'modal') {
    return (
      <AccessibleModal show={showModal} onHide={handleHide}>
        <Modal.Header closeButton>
          <Modal.Title>{t('inr_discount_modal_title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="modal-body-share">
          <p>
            <img
              alt={t('inr_discount_modal_title')}
              src="/img/subscriptions/inr-discount-modal.png"
              style={{
                width: '100%',
              }}
            />
          </p>
          <p>{t('inr_discount_modal_info')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button bsStyle="default" onClick={handleMaybeLater}>
            {t('maybe_later')}
          </Button>
          <Button type="button" bsStyle="primary" onClick={handleClick}>
            {t('get_discounted_plan')}
          </Button>
        </Modal.Footer>
      </AccessibleModal>
    )
  } else {
    return null
  }
}
