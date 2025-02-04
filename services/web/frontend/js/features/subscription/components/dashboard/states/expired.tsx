import { useTranslation } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../types/subscription/dashboard/subscription'
import OLButton from '@/features/ui/components/ol/ol-button'

export function ExpiredSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()

  return (
    <>
      <p>{t('your_subscription_has_expired')}</p>
      <p>
        <OLButton
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
          variant="secondary"
          className="me-1"
        >
          {t('view_your_invoices')}
        </OLButton>
        <OLButton href="/user/subscription/plans" variant="primary">
          {t('create_new_subscription')}
        </OLButton>
      </p>
    </>
  )
}
