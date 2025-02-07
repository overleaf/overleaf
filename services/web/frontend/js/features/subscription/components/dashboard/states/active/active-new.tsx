import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { PendingPlanChange } from './pending-plan-change'
import { TrialEnding } from './trial-ending'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import { CancelAiAddOnModal } from '@/features/subscription/components/dashboard/states/active/change-plan/modals/cancel-ai-add-on-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import isInFreeTrial from '../../../../util/is-in-free-trial'
import { bsVersion } from '@/features/utils/bootstrap-5'
import AddOns from '@/features/subscription/components/dashboard/states/active/add-ons'
import {
  AI_ADD_ON_CODE,
  AI_STANDALONE_PLAN_CODE,
  isStandaloneAiPlanCode,
} from '@/features/subscription/data/add-on-codes'
import getMeta from '@/utils/meta'
import classnames from 'classnames'
import SubscriptionRemainder from '@/features/subscription/components/dashboard/states/active/subscription-remainder'
import { sendMB } from '../../../../../../infrastructure/event-tracking'

export function ActiveSubscriptionNew({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    setModalIdShown,
    showCancellation,
    institutionMemberships,
    memberGroupSubscriptions,
  } = useSubscriptionDashboardContext()

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
    if ([AI_STANDALONE_PLAN_CODE, AI_ADD_ON_CODE].includes(addOnCode)) {
      setModalIdShown('cancel-ai-add-on')
    }
  }

  const isLegacyPlan =
    subscription.recurly.totalLicenses !==
    subscription.recurly.additionalLicenses

  return (
    <>
      <h2 className={classnames('h3', bsVersion({ bs5: 'fw-bold' }))}>
        {t('billing')}
      </h2>
      <p className="mb-1">
        {subscription.plan.annual ? (
          <Trans
            i18nKey="billed_annually_at"
            values={{ price: subscription.recurly.displayPrice }}
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
            values={{ price: subscription.recurly.displayPrice }}
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
      <p className="mb-1">
        <Trans
          i18nKey="renews_on"
          values={{ date: subscription.recurly.nextPaymentDueDate }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[<strong />]} // eslint-disable-line react/jsx-key
        />
      </p>
      <div>
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
          className="me-2"
        >
          {t('view_invoices')}
        </a>
        <a
          href={subscription.recurly.billingDetailsLink}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('view_billing_details')}
        </a>
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
      <h2 className={classnames('h3', bsVersion({ bs5: 'fw-bold' }))}>
        {t('plan')}
      </h2>
      <h3 className={classnames('h5 mt-0 mb-1', bsVersion({ bs5: 'fw-bold' }))}>
        {planName}
      </h3>
      <p className="mb-1">
        {subscription.pendingPlan && (
          <>
            {' '}
            <PendingPlanChange subscription={subscription} />
          </>
        )}
      </p>
      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p className="mb-1">{t('want_change_to_apply_before_plan_end')}</p>
        )}
      {isInFreeTrial(subscription.recurly.trial_ends_at) &&
        subscription.recurly.trialEndsAtFormatted && (
          <TrialEnding
            trialEndsAtFormatted={subscription.recurly.trialEndsAtFormatted}
            className="mb-1"
          />
        )}
      {!subscription.pendingPlan && subscription.recurly.totalLicenses > 0 && (
        <p className="mb-1">
          {isLegacyPlan && subscription.recurly.additionalLicenses > 0 ? (
            <Trans
              i18nKey="plus_x_additional_licenses_for_a_total_of_y_users"
              values={{
                count: subscription.recurly.totalLicenses,
                additionalLicenses: subscription.recurly.additionalLicenses,
              }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              components={[<strong />, <strong />]} // eslint-disable-line react/jsx-key
            />
          ) : (
            <Trans
              i18nKey="supports_up_to_x_users"
              values={{ count: subscription.recurly.totalLicenses }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
              components={[<strong />]} // eslint-disable-line react/jsx-key
            />
          )}
        </p>
      )}
      {!onStandalonePlan && (
        <p className="mb-1">
          {subscription.plan.annual
            ? t('x_price_per_year', {
                price: subscription.recurly.planOnlyDisplayPrice,
              })
            : t('x_price_per_month', {
                price: subscription.recurly.planOnlyDisplayPrice,
              })}
        </p>
      )}
      {!recurlyLoadError && (
        <PlanActions
          subscription={subscription}
          onStandalonePlan={onStandalonePlan}
          handlePlanChange={handlePlanChange}
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
    </>
  )
}

type PlanActionsProps = {
  subscription: RecurlySubscription
  onStandalonePlan: boolean
  handlePlanChange: () => void
}

function PlanActions({
  subscription,
  onStandalonePlan,
  handlePlanChange,
}: PlanActionsProps) {
  const { t } = useTranslation()
  const isSubscriptionEligibleForFlexibleGroupLicensing = getMeta(
    'ol-canUseFlexibleLicensing'
  )

  return (
    <div className="mt-3">
      {isSubscriptionEligibleForFlexibleGroupLicensing ? (
        <FlexibleGroupLicensingActions subscription={subscription} />
      ) : (
        <>
          {subscription.recurly.account.has_past_due_invoice._ !== 'true' && (
            <OLButton variant="secondary" onClick={handlePlanChange}>
              {t('upgrade_plan')}
            </OLButton>
          )}
        </>
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
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
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
          {t('add_more_users')}
        </OLButton>
      )}
    </>
  )
}
