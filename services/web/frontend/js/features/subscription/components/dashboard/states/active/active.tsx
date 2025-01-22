import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { PendingPlanChange } from './pending-plan-change'
import { TrialEnding } from './trial-ending'
import { PendingAdditionalLicenses } from './pending-additional-licenses'
import { ContactSupportToChangeGroupPlan } from './contact-support-to-change-group-plan'
import SubscriptionRemainder from './subscription-remainder'
import isInFreeTrial from '../../../../util/is-in-free-trial'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import useAsync from '@/shared/hooks/use-async'
import { postJSON } from '@/infrastructure/fetch-json'
import PauseSubscriptionModal from '../../pause-modal'
import Notification from '@/shared/components/notification'
import { debugConsole } from '@/utils/debugging'
import { FlashMessage } from './flash-message'
import { useLocation } from '@/shared/hooks/use-location'
import LoadingSpinner from '@/shared/components/loading-spinner'

export function ActiveSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    setModalIdShown,
    showCancellation,
    getFormattedRenewalDate,
  } = useSubscriptionDashboardContext()
  const {
    isError: isErrorPause,
    runAsync: runAsyncCancelPause,
    isLoading: isLoadingCancelPause,
  } = useAsync()
  const location = useLocation()

  if (showCancellation) return <CancelSubscription />

  const hasPendingPause =
    subscription.recurly.state === 'active' &&
    subscription.recurly.remainingPauseCycles &&
    subscription.recurly.remainingPauseCycles > 0

  const handleCancelPendingPauseClick = async () => {
    try {
      await runAsyncCancelPause(postJSON('/user/subscription/pause/0'))
      const newUrl = new URL(location.toString())
      newUrl.searchParams.set('flash', 'unpaused')
      window.history.replaceState(null, '', newUrl)
      location.reload()
    } catch (e) {
      debugConsole.error(e)
    }
  }

  return (
    <>
      <div className="notification-list">
        <FlashMessage />

        {isErrorPause && (
          <Notification
            type="error"
            content={t('generic_something_went_wrong')}
          />
        )}
      </div>
      <p>
        {!hasPendingPause && (
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
        )}
        {subscription.pendingPlan && (
          <>
            {' '}
            <PendingPlanChange subscription={subscription} />
          </>
        )}
        {!subscription.pendingPlan &&
          subscription.recurly.additionalLicenses > 0 && (
            <>
              {' '}
              <PendingAdditionalLicenses
                additionalLicenses={subscription.recurly.additionalLicenses}
                totalLicenses={subscription.recurly.totalLicenses}
              />
            </>
          )}
        {!recurlyLoadError &&
          !subscription.groupPlan &&
          !hasPendingPause &&
          subscription.recurly.account.has_past_due_invoice._ !== 'true' && (
            <>
              {' '}
              <OLButton
                variant="link"
                className="btn-inline-link"
                onClick={() => setModalIdShown('change-plan')}
              >
                {t('change_plan')}
              </OLButton>
            </>
          )}
      </p>
      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p>{t('want_change_to_apply_before_plan_end')}</p>
        )}
      {(!subscription.pendingPlan ||
        subscription.pendingPlan.name === subscription.plan.name) &&
        subscription.plan.groupPlan && <ContactSupportToChangeGroupPlan />}
      {isInFreeTrial(subscription.recurly.trial_ends_at) &&
        subscription.recurly.trialEndsAtFormatted && (
          <TrialEnding
            trialEndsAtFormatted={subscription.recurly.trialEndsAtFormatted}
          />
        )}

      {hasPendingPause && (
        <>
          <p>
            <Trans
              i18nKey="your_subscription_will_pause_on"
              values={{
                planName: subscription.plan.name,
                pauseDate: subscription.recurly.nextPaymentDueAt,
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
          <p>{t('you_can_still_use_your_premium_features')}</p>
          <p>
            <OLButton
              variant="primary"
              onClick={handleCancelPendingPauseClick}
              disabled={isLoadingCancelPause}
            >
              {isLoadingCancelPause ? (
                <LoadingSpinner />
              ) : (
                t('unpause_subscription')
              )}
            </OLButton>
          </p>
        </>
      )}

      <p>
        <Trans
          i18nKey="next_payment_of_x_collectected_on_y"
          values={{
            paymentAmmount: subscription.recurly.displayPrice,
            collectionDate: getFormattedRenewalDate(),
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>

      <hr />
      <PriceExceptions subscription={subscription} />
      <p className="d-inline-flex flex-wrap gap-1">
        <a
          href={subscription.recurly.billingDetailsLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('update_your_billing_details')}
        </a>{' '}
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('view_your_invoices')}
        </a>
        {!recurlyLoadError && (
          <>
            {' '}
            <CancelSubscriptionButton />
          </>
        )}
      </p>

      {!recurlyLoadError && (
        <>
          <br />
          <p>
            <i>
              <SubscriptionRemainder subscription={subscription} />
            </i>
          </p>
        </>
      )}

      <ChangePlanModal />
      <ConfirmChangePlanModal />
      <KeepCurrentPlanModal />
      <ChangeToGroupModal />
      <PauseSubscriptionModal />
    </>
  )
}
