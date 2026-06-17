import { Trans, useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'

function RedirectAlerts() {
  const queryParams = new URLSearchParams(window.location.search)
  const redirectReason = queryParams.get('redirect-reason')
  const { t } = useTranslation()

  if (!redirectReason) {
    return null
  }

  let warning
  let action
  if (redirectReason === 'writefull-entitled') {
    warning = t('good_news_you_are_already_receiving_this_add_on_via_writefull')
  } else if (redirectReason === 'double-buy') {
    warning = t('good_news_you_already_purchased_this_add_on')
  } else if (redirectReason === 'ai-assist-unavailable') {
    warning = (
      <Trans
        i18nKey="ai_assist_unavailable"
        components={[
          // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
          <a href="/user/subscription/plans" />,
        ]}
      />
    )
  } else if (redirectReason === 'subscription-paused') {
    warning = t('no_add_on_purchase_while_paused')
  } else if (redirectReason === 'no-active-subscription') {
    warning = t('your_subscription_has_expired')
    action = (
      <OLButton href="/user/subscription/payment/invoices" variant="secondary">
        {t('view_your_invoices')}
      </OLButton>
    )
  } else {
    return null
  }

  return (
    <OLNotification type="warning" content={<>{warning}</>} action={action} />
  )
}
export default RedirectAlerts
