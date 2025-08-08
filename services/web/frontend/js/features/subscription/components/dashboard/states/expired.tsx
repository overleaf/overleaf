import { useTranslation } from 'react-i18next'
import { PaidSubscription } from '../../../../../../../types/subscription/dashboard/subscription'
import OLButton from '@/shared/components/ol/ol-button'

export function ExpiredSubscription({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()

  return (
    <>
      <p>{t('your_subscription_has_expired')}</p>
      <p>
        <OLButton
          href={subscription.payment.accountManagementLink}
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
