import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import { Modal, Button } from 'react-bootstrap'
import AccessibleModal from '../../../../../shared/components/accessible-modal'

export default function BackToSchoolModal() {
  const { t } = useTranslation()
  const [dismissedUntil, setDismissedUntil] = usePersistedState<
    Date | undefined
  >(`has_dismissed_back_to_school_modal_until`)
  const viewEventSent = useRef<boolean>(false)

  const [showModal, setShowModal] = useState(true)

  useEffect(() => {
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      return
    }
    if (!viewEventSent.current) {
      eventTracking.sendMB('promo-prompt', {
        name: 'bts2023',
        location: 'dashboard-modal',
        content: 'modal',
      })
      viewEventSent.current = true
    }
  }, [dismissedUntil])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      name: 'bts2023',
      location: 'dashboard-modal',
      content: 'modal',
      type: 'click',
    })

    setShowModal(false)

    window.open('/about/back-to-school-promo-2023')
  }, [])

  const bannerDismissed = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      name: 'bts2023',
      location: 'dashboard-modal',
      content: 'modal',
    })
    const until = new Date()
    until.setDate(until.getDate() + 14) // 14 days
    setDismissedUntil(until)
  }, [setDismissedUntil])

  const handleHide = useCallback(() => {
    setShowModal(false)
    bannerDismissed()
  }, [bannerDismissed])

  const handleMaybeLater = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      name: 'bts2023',
      location: 'dashboard-modal',
      content: 'modal',
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
    <AccessibleModal show={showModal} onHide={handleHide}>
      <Modal.Header style={{ borderBottom: 'none' }} closeButton>
        <Modal.Title style={{ fontSize: '20px' }}>
          {t('back_to_school_bargain_for_everyone')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="modal-body-share">
        <p>
          <img
            alt=""
            src="/img/subscriptions/back-to-school-modal.png"
            style={{
              width: '100%',
            }}
          />
        </p>
        <strong style={{ fontSize: '20px' }}>
          {t('back_to_school_banner_x_percent_off', { x: '15' })}
        </strong>
        <p>{t('back_to_school_modal_offers_from_writefull_and_papers')}</p>
        <p>{t('back_to_school_banner_extended_offer_oct_15')}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button bsStyle="default" onClick={handleMaybeLater}>
          {t('maybe_later')}
        </Button>
        <Button type="button" bsStyle="primary" onClick={handleClick}>
          {t('claim_discounts')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
