import { useTranslation } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../types/subscription/dashboard/subscription'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

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
        <a
          href={subscription.recurly.accountManagementLink}
          className="btn btn-secondary-info btn-secondary me-1"
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('view_your_invoices')}
        </a>
        {isSplitTestEnabled('ai-add-on') && (
          <a
            className="btn btn-secondary me-1"
            href="/user/subscription/new?planCode=assistant"
          >
            {t('buy_overleaf_assist')}
          </a>
        )}
        <a href="/user/subscription/plans" className="btn btn-primary">
          {t('create_new_subscription')}
        </a>
      </p>
    </>
  )
}
