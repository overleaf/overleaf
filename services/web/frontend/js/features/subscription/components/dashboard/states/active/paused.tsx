import { useTranslation, Trans } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import OLButton from '@/shared/components/ol/ol-button'
import PauseSubscriptionModal from '../../pause-modal'
import { ConfirmUnpauseSubscriptionModal } from './confirm-unpause-modal'

export function PausedSubscription({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    setModalIdShown,
    showCancellation,
    getFormattedRenewalDate,
  } = useSubscriptionDashboardContext()

  if (showCancellation) return <CancelSubscription />

  const handleUnpauseClick = async () => {
    setModalIdShown('unpause-subscription')
  }

  return (
    <>
      <p>
        <Trans
          i18nKey="youve_paused_your_subscription"
          values={{
            planName: subscription.plan.name,
            reactivationDate: getFormattedRenewalDate(),
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <p>{t('until_then_you_can_still')}</p>
      <ul>
        <li>{t('access_edit_your_projects')}</li>
        <li>{t('continue_using_free_features')}</li>
      </ul>
      <p>{t('well_be_here_when_youre_ready')}</p>
      <p>
        <OLButton variant="primary" onClick={handleUnpauseClick}>
          {t('unpause_subscription')}
        </OLButton>
        {!recurlyLoadError && (
          <>
            {' '}
            <CancelSubscriptionButton />
          </>
        )}
      </p>

      <p className="d-inline-flex flex-wrap gap-1">
        {subscription.payment.billingDetailsLink ? (
          <>
            <a
              href={subscription.payment.billingDetailsLink}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary-info btn-secondary"
            >
              {t('update_your_billing_details')}
            </a>{' '}
            <a
              href={subscription.payment.accountManagementLink}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary-info btn-secondary"
            >
              {t('view_your_invoices')}
            </a>
          </>
        ) : (
          <a
            href={subscription.payment.accountManagementLink}
            rel="noreferrer noopener"
            className="btn btn-secondary-info btn-secondary"
          >
            {t('view_payment_portal')}
          </a>
        )}
      </p>

      <ChangePlanModal />
      <ConfirmChangePlanModal />
      <KeepCurrentPlanModal />
      <ChangeToGroupModal />
      <PauseSubscriptionModal />
      <ConfirmUnpauseSubscriptionModal />
    </>
  )
}
