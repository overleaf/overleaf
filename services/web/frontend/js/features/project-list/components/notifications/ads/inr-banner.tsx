import { useCallback, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import Notification from '../notification'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import { Button } from 'react-bootstrap'

export default function INRBanner() {
  const { t } = useTranslation()
  const [dismissedAt, setDismissedAt] = usePersistedState<Date | undefined>(
    `has_dismissed_inr_banner`
  )

  useEffect(() => {
    eventTracking.sendMB('paywall-prompt', {
      'paywall-type': 'inr-banner',
    })
  }, [])

  useEffect(() => {
    if (!dismissedAt) {
      return
    }
    const dismissedAtDate = new Date(dismissedAt)
    const recentlyDismissedCutoff = new Date()
    recentlyDismissedCutoff.setDate(recentlyDismissedCutoff.getDate() - 30) // 30 days
    // once dismissedAt passes the cut-off mark, banner will be shown again
    if (dismissedAtDate <= recentlyDismissedCutoff) {
      setDismissedAt(undefined)
    }
  }, [dismissedAt, setDismissedAt])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('paywall-click', { 'paywall-type': 'inr-banner' })

    window.open('/user/subscription/plans')
  }, [])

  if (dismissedAt) {
    return null
  }

  return (
    <Notification bsStyle="info" onDismiss={() => setDismissedAt(new Date())}>
      <Notification.Body>
        <Trans
          i18nKey="inr_discount_offer"
          components={[<b />]} // eslint-disable-line react/jsx-key
        />
      </Notification.Body>
      <Notification.Action>
        <Button
          bsStyle="info"
          bsSize="sm"
          className="pull-right"
          onClick={handleClick}
        >
          {t('get_discounted_plan')}
        </Button>
      </Notification.Action>
    </Notification>
  )
}
