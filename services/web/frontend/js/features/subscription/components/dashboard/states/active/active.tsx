import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { TrialEnding } from './trial-ending'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import { CancelAiAddOnModal } from '@/features/subscription/components/dashboard/states/active/change-plan/modals/cancel-ai-add-on-modal'
import OLButton from '@/shared/components/ol/ol-button'
import isInFreeTrial from '../../../../util/is-in-free-trial'
import AddOns from '@/features/subscription/components/dashboard/states/active/add-ons'
import {
  AI_ADD_ON_CODE,
  AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE,
  isStandaloneAiPlanCode,
} from '@/features/subscription/data/add-on-codes'
import getMeta from '@/utils/meta'
import SubscriptionRemainder from '@/features/subscription/components/dashboard/states/active/subscription-remainder'
import { sendMB } from '../../../../../../infrastructure/event-tracking'
import PauseSubscriptionModal from '@/features/subscription/components/dashboard/pause-modal'
import LoadingSpinner from '@/shared/components/loading-spinner'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import useAsync from '@/shared/hooks/use-async'
import { useLocation } from '@/shared/hooks/use-location'
import { FlashMessage } from '@/features/subscription/components/dashboard/states/active/flash-message'
import Notification from '@/shared/components/notification'
import { PendingPlanChange } from './pending-plan-change'

export function ActiveSubscription({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    setModalIdShown,
    showCancellation,
    institutionMemberships,
    memberGroupSubscriptions,
    getFormattedRenewalDate,
  } = useSubscriptionDashboardContext()
  const cancelPauseReq = useAsync()
  const { isError: isErrorPause } = cancelPauseReq

  if (showCancellation) return <CancelSubscription />

  const onStandalonePlan = isStandaloneAiPlanCode(subscription.planCode)

  let planName
  if (onStandalonePlan) {
    planName = 'Overleaf Free'
    if (institutionMemberships && institutionMemberships.length > 0) {
      planName = 'Overleaf Professional'
    }
    if (memberGroupSubscriptions.length > 0) {
      if (
        memberGroupSubscriptions.some(s => s.planLevelName === 'Professional')
      ) {
        planName = 'Overleaf Professional'
      } else {
        planName = 'Overleaf Standard'
      }
    }
  } else {
    planName = subscription.plan.name
  }

  const handlePlanChange = () => setModalIdShown('change-plan')

  const handleCancelClick = (addOnCode: string) => {
    if (
      [AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE, AI_ADD_ON_CODE].includes(
        addOnCode
      )
    ) {
      setModalIdShown('cancel-ai-add-on')
    }
  }

  const hasPendingPause = Boolean(
    subscription.payment.state === 'active' &&
    subscription.payment.remainingPauseCycles &&
    subscription.payment.remainingPauseCycles > 0
  )

  const isLegacyPlan =
    subscription.payment.totalLicenses !==
    subscription.payment.additionalLicenses

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
      <h2 className="h3 fw-bold">{t('billing')}</h2>
      <p className="mb-1" data-testid="billing-period">
        {subscription.plan.annual ? (
          <Trans
            i18nKey="billed_annually_at"
            values={{ price: subscription.payment.displayPrice }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
              // eslint-disable-next-line react/jsx-key
              <i />,
            ]}
          />
        ) : (
          <Trans
            i18nKey="billed_monthly_at"
            values={{ price: subscription.payment.displayPrice }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
              // eslint-disable-next-line react/jsx-key
              <i />,
            ]}
          />
        )}
      </p>
      <p className="mb-1" data-testid="renews-on">
        <Trans
          i18nKey="renews_on"
          values={{ date: subscription.payment.nextPaymentDueDate }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[<strong />]} // eslint-disable-line react/jsx-key
        />
      </p>
      <div>
        {subscription.payment.billingDetailsLink ? (
          <>
            <a
              href={subscription.payment.accountManagementLink}
              target="_blank"
              rel="noreferrer noopener"
              className="me-2"
            >
              {t('view_invoices')}
            </a>
            <a
              href={subscription.payment.billingDetailsLink}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('view_billing_details')}
            </a>
          </>
        ) : (
          <a
            href={subscription.payment.accountManagementLink}
            rel="noreferrer noopener"
            className="me-2"
          >
            {t('view_payment_portal')}
          </a>
        )}
      </div>
      <div className="mt-3">
        <PriceExceptions subscription={subscription} />
        {!recurlyLoadError && (
          <p>
            <i>
              <SubscriptionRemainder subscription={subscription} hideTime />
            </i>
          </p>
        )}
      </div>
      <hr />
      <h2 className="h3 fw-bold">{t('plan')}</h2>
      <h3 className="h5 mt-0 mb-1 fw-bold">{planName}</h3>
      {isInFreeTrial(subscription.payment.trialEndsAt) &&
        subscription.payment.trialEndsAtFormatted && (
          <TrialEnding
            trialEndsAtFormatted={subscription.payment.trialEndsAtFormatted}
            className="mb-1"
          />
        )}
      {subscription.payment.totalLicenses > 0 && (
        <p className="mb-1" data-testid="plan-licenses">
          {isLegacyPlan &&
          subscription.payment.additionalLicenses > 0 &&
          !subscription.payment.pendingAdditionalLicenses ? (
            <Trans
              i18nKey="plus_x_additional_licenses_for_a_total_of_y_licenses"
              values={{
                count: subscription.payment.totalLicenses,
                additionalLicenses: subscription.payment.additionalLicenses,
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
            />
          ) : (
            <Trans
              i18nKey="supports_up_to_x_licenses"
              values={{ count: subscription.payment.totalLicenses }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              components={[<strong />]} // eslint-disable-line react/jsx-key
            />
          )}
        </p>
      )}
      {subscription.pendingPlan && (
        <p className="mb-1" data-testid="pending-plan-change">
          {' '}
          <PendingPlanChange subscription={subscription} />
        </p>
      )}

      {hasPendingPause && (
        <>
          <p>
            <Trans
              i18nKey="your_subscription_will_pause_on"
              values={{
                planName: subscription.plan.name,
                pauseDate: subscription.payment.nextPaymentDueAt,
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
        </>
      )}
      {!onStandalonePlan && (
        <p className="mb-1" data-testid="plan-only-price">
          {subscription.plan.annual
            ? t('x_price_per_year', {
                price: subscription.payment.planOnlyDisplayPrice,
              })
            : t('x_price_per_month', {
                price: subscription.payment.planOnlyDisplayPrice,
              })}
        </p>
      )}

      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p className="mb-1">{t('want_change_to_apply_before_plan_end')}</p>
        )}

      {!recurlyLoadError && (
        <PlanActions
          subscription={subscription}
          onStandalonePlan={onStandalonePlan}
          handlePlanChange={handlePlanChange}
          hasPendingPause={hasPendingPause}
          cancelPauseReq={cancelPauseReq}
        />
      )}
      <hr />
      <AddOns
        subscription={subscription}
        onStandalonePlan={onStandalonePlan}
        handleCancelClick={handleCancelClick}
      />

      <ChangePlanModal />
      <ConfirmChangePlanModal />
      <KeepCurrentPlanModal />
      <ChangeToGroupModal />
      <CancelAiAddOnModal />
      <PauseSubscriptionModal />
    </>
  )
}

type PlanActionsProps = {
  subscription: PaidSubscription
  onStandalonePlan: boolean
  handlePlanChange: () => void
  hasPendingPause: boolean
  cancelPauseReq: ReturnType<typeof useAsync>
}

function PlanActions({
  subscription,
  onStandalonePlan,
  handlePlanChange,
  hasPendingPause,
  cancelPauseReq,
}: PlanActionsProps) {
  const { t } = useTranslation()
  const isSubscriptionEligibleForFlexibleGroupLicensing = getMeta(
    'ol-canUseFlexibleLicensing'
  )
  const location = useLocation()
  const { runAsync: runAsyncCancelPause, isLoading: isLoadingCancelPause } =
    cancelPauseReq

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
    <div className="mt-3">
      {isSubscriptionEligibleForFlexibleGroupLicensing ? (
        <FlexibleGroupLicensingActions subscription={subscription} />
      ) : (
        <>
          {!hasPendingPause && !subscription.payment.hasPastDueInvoice && (
            <OLButton variant="secondary" onClick={handlePlanChange}>
              {t('change_plan')}
            </OLButton>
          )}
        </>
      )}
      {hasPendingPause && (
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
      )}
      {!onStandalonePlan && (
        <>
          {' '}
          <CancelSubscriptionButton />
        </>
      )}
    </div>
  )
}

function FlexibleGroupLicensingActions({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()

  if (subscription.pendingPlan || subscription.payment.hasPastDueInvoice) {
    return null
  }

  const isProfessionalPlan = subscription.planCode
    .toLowerCase()
    .includes('professional')

  return (
    <>
      {!isProfessionalPlan && (
        <>
          <OLButton
            variant="secondary"
            href="/user/subscription/group/upgrade-subscription"
            onClick={() =>
              sendMB('flex-upgrade', { location: 'upgrade-plan-button' })
            }
          >
            {t('upgrade_plan')}
          </OLButton>{' '}
        </>
      )}
      {subscription.plan.membersLimitAddOn === 'additional-license' && (
        <OLButton
          variant="secondary"
          href="/user/subscription/group/add-users"
          onClick={() => sendMB('flex-add-users')}
        >
          {t('buy_more_licenses')}
        </OLButton>
      )}
    </>
  )
}
