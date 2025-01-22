import { useSubscriptionDashboardContext } from '@/features/subscription/context/subscription-dashboard-context'
import Notification from '@/shared/components/notification'
import { Trans, useTranslation } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { useEffect, useState } from 'react'
import { useLocation } from '@/shared/hooks/use-location'

export type FlashMessageName = 'paused' | 'unpaused' | 'error'

export function FlashMessage() {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const location = useLocation()
  const [message] = useState(
    // eslint-disable-next-line no-restricted-syntax
    new URL(window.location.toString()).searchParams.get(
      'flash'
    ) as FlashMessageName
  )
  const subscription = personalSubscription as RecurlySubscription
  useEffect(() => {
    // clear any flash message IDs so they only show once
    if (location.toString()) {
      const newUrl = new URL(location.toString())
      newUrl.searchParams.delete('flash')
      window.history.replaceState(null, '', newUrl)
    }
  }, [location])

  switch (message) {
    case 'paused':
      return (
        <Notification
          type="success"
          content={
            <Trans
              i18nKey="your_subscription_will_pause_on_short"
              values={{
                pauseDate: subscription.recurly.nextPaymentDueAt,
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              components={[
                // eslint-disable-next-line react/jsx-key
                <strong />,
              ]}
            />
          }
        />
      )
    case 'unpaused':
      return (
        <Notification
          type="success"
          content={t('you_unpaused_your_subscription')}
        />
      )
    default:
      return <></>
  }
}
