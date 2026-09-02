import { Trans } from 'react-i18next'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'

export default function RedirectedPaymentErrorNotification() {
  const hasRedirectedPaymentError = Boolean(
    getMeta('ol-subscriptionPaymentErrorCode')
  )

  if (!hasRedirectedPaymentError) {
    return null
  }

  return (
    <div className="notification-list">
      <Notification
        className="mb-4"
        aria-live="polite"
        content={
          <Trans
            i18nKey="payment_error_generic"
            components={[
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              <a href="/contact" target="_blank" />,
            ]}
          />
        }
        type="error"
      />
    </div>
  )
}
