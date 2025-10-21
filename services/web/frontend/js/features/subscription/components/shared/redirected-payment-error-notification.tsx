import { Trans } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import getMeta from '@/utils/meta'

export default function RedirectedPaymentErrorNotification() {
  const hasRedirectedPaymentError = Boolean(
    getMeta('ol-subscriptionPaymentErrorCode')
  )

  if (!hasRedirectedPaymentError) {
    return null
  }

  return (
    <OLNotification
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
  )
}
