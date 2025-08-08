import { FetchError } from '@/infrastructure/fetch-json'
import { Trans } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import { billingPortalUrl } from '../../data/subscription-url'

type Props = {
  error: FetchError | null
}

export default function PaymentErrorNotification({ error }: Props) {
  if (!error) {
    return
  }

  let message
  switch (error.data?.adviceCode) {
    case 'try_again_later':
      message = (
        <Trans
          i18nKey="payment_error_intermittent_error"
          components={[
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            <a href="/contact" target="_blank" />,
          ]}
        />
      )
      break
    case 'do_not_try_again':
    case 'confirm_card_data':
      message = (
        <Trans
          i18nKey="payment_error_update_payment_method"
          components={[
            /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
            <a href={billingPortalUrl} />,
          ]}
        />
      )
      break
    default:
      // clientSecret indicates they needed to pass a 3DS challenge
      if (error.data?.clientSecret) {
        message = (
          <Trans
            i18nKey="payment_error_3ds_failed"
            components={[
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              <a href="/contact" target="_blank" />,
            ]}
          />
        )
      } else {
        message = (
          <Trans
            i18nKey="payment_error_generic"
            components={[
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              <a href="/contact" target="_blank" />,
            ]}
          />
        )
      }
  }

  return <OLNotification type="error" aria-live="polite" content={message} />
}
