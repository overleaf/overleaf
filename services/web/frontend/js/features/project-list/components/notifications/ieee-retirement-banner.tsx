import { useCallback, useEffect } from 'react'
import Notification from './notification'
import { Trans } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import useAsyncDismiss from './hooks/useAsyncDismiss'

let viewEventSent = false

type IEEERetirementBannerProps = {
  id: number | undefined
}

export default function IEEERetirementBanner({
  id,
}: IEEERetirementBannerProps) {
  const { handleDismiss } = useAsyncDismiss()

  const handleClose = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      name: 'ieee - retirement',
    })
    if (id) {
      handleDismiss(id)
    }
  }, [id, handleDismiss])

  const handleClickPlans = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      name: 'ieee - retirement',
      content: 'plans',
    })
  }, [])

  const handleClickEmail = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      name: 'ieee - retirement',
      content: 'email',
    })
  }, [])

  useEffect(() => {
    if (!viewEventSent) {
      eventTracking.sendMB('promo-prompt', {
        name: 'ieee - retirement',
      })
      viewEventSent = true
    }
  }, [])

  return (
    <Notification
      bsStyle="warning"
      onDismiss={handleClose}
      newNotificationStyle
      body={
        <Trans
          i18nKey="notification_ieee_collabratec_retirement_message"
          components={[
            // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
            <a href="mailto:authors@ieee.org" onClick={handleClickEmail} />,
            // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
            <a href="/user/subscription" onClick={handleClickPlans} />,
          ]}
        />
      }
    />
  )
}
