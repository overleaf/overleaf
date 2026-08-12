import { useTranslation, Trans } from 'react-i18next'
import { PaidSubscription } from '../../../../../../../types/subscription/dashboard/subscription'
import {
  hasPendingAiAddonCancellation,
  ADD_ON_NAME,
} from '../../../data/add-on-codes'
import ReactivateSubscription from '../reactivate-subscription'
import OLButton from '@/shared/components/ol/ol-button'

export function CanceledSubscription({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  const pendingAiAddonCancellation = hasPendingAiAddonCancellation(subscription)

  return (
    <>
      <p>
        <Trans
          i18nKey="currently_subscribed_to_plan"
          values={{
            planName: subscription.plan.name,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      {pendingAiAddonCancellation && (
        <p>
          <Trans
            i18nKey="pending_addon_cancellation"
            values={{
              addOnName: ADD_ON_NAME,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={{ strong: <strong /> }}
          />
        </p>
      )}
      <p>
        <Trans
          i18nKey="subscription_canceled_and_terminate_on_x"
          values={{
            terminateDate: subscription.payment.nextPaymentDueAt,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <p>
        <OLButton
          href={subscription.payment.accountManagementLink}
          target="_blank"
          variant="secondary"
          rel="noopener noreferrer"
        >
          {t('view_your_invoices')}
        </OLButton>
      </p>
      <ReactivateSubscription />
    </>
  )
}
