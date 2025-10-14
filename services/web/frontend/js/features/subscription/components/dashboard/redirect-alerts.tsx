import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'

function RedirectAlerts() {
  const queryParams = new URLSearchParams(window.location.search)
  const redirectReason = queryParams.get('redirect-reason')
  const { t } = useTranslation()

  if (!redirectReason) {
    return null
  }

  let warning
  if (redirectReason === 'writefull-entitled') {
    warning = t('good_news_you_are_already_receiving_this_add_on_via_writefull')
  } else if (redirectReason === 'double-buy') {
    warning = t('good_news_you_already_purchased_this_add_on')
  } else if (redirectReason === 'ai-assist-unavailable') {
    warning = t('ai_assist_unavailable_due_to_subscription_type')
  } else if (redirectReason === 'subscription-paused') {
    warning = t('no_add_on_purchase_while_paused')
  } else {
    return null
  }

  return <OLNotification type="warning" content={<>{warning}</>} />
}
export default RedirectAlerts
