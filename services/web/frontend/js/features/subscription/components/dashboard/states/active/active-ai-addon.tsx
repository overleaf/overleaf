import { useTranslation, Trans } from 'react-i18next'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { PendingPlanChange } from './pending-plan-change'
import SubscriptionRemainder from './subscription-remainder'
import { ChangePlanModal } from './change-plan/modals/change-plan-modal'
import { ConfirmChangePlanModal } from './change-plan/modals/confirm-change-plan-modal'
import { KeepCurrentPlanModal } from './change-plan/modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './change-plan/modals/change-to-group-modal'
import { CancelAiAddOnModal } from './change-plan/modals/cancel-ai-add-on-modal'
import { PendingRecurlyPlan } from '../../../../../../../../types/subscription/plan'
import {
  ADD_ON_NAME,
  AI_ADD_ON_CODE,
  isStandaloneAiPlanCode,
} from '../../../../data/add-on-codes'
import { CancelSubscriptionButton } from './cancel-subscription-button'

import OLButton from '@/features/ui/components/ol/ol-button'

export function ActiveAiAddonSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    showCancellation,
    setModalIdShown,
    memberGroupSubscriptions,
    institutionMemberships,
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

  const handleCancelClick = () => setModalIdShown('cancel-ai-add-on')

  return (
    <>
      <p className="mb-0">
        <Trans
          i18nKey="your_plan_is"
          values={{ planName }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={{ strong: <strong /> }}
        />
      </p>
      <p>
        <Trans
          i18nKey="add_ons_are"
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          values={{
            addOnName: ADD_ON_NAME,
          }}
          components={{ strong: <strong /> }}
        />
      </p>
      <p>
        {subscription.pendingPlan && (
          <PendingPlanChange subscription={subscription} />
        )}
      </p>
      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p>{t('want_change_to_apply_before_plan_end')}</p>
        )}
      <p>
        <Trans
          i18nKey="next_payment_of_x_collectected_on_y"
          values={{
            paymentAmmount: subscription.recurly.displayPrice,
            collectionDate: subscription.recurly.nextPaymentDueDate,
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
      <PriceExceptions subscription={subscription} />
      {!recurlyLoadError && (
        <p>
          <i>
            <SubscriptionRemainder subscription={subscription} hideTime />
          </i>
        </p>
      )}
      {!recurlyLoadError && (
        <p className="d-inline-flex flex-wrap gap-1">
          {onStandalonePlan ? (
            <StandaloneAiPlanActions
              handlePlanChange={handlePlanChange}
              handleCancelClick={handleCancelClick}
            />
          ) : (
            <PlanWithAddonsActions
              handlePlanChange={handlePlanChange}
              handleCancelClick={handleCancelClick}
              subscription={subscription}
            />
          )}
        </p>
      )}
      <p>
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('view_invoices')}
        </a>
      </p>
      <p>
        <a
          href={subscription.recurly.billingDetailsLink}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('update_billing_details')}
        </a>
      </p>

      <ChangePlanModal />
      <ConfirmChangePlanModal />
      <KeepCurrentPlanModal />
      <ChangeToGroupModal />
      <CancelAiAddOnModal />
    </>
  )
}

function StandaloneAiPlanActions({
  handlePlanChange,
  handleCancelClick,
}: {
  handlePlanChange(): void
  handleCancelClick(): void
}) {
  const { t } = useTranslation()
  return (
    <>
      <OLButton variant="secondary" onClick={handlePlanChange}>
        {t('upgrade')}
      </OLButton>
      <OLButton variant="danger-ghost" onClick={handleCancelClick}>
        {t('remove_add_on')}
      </OLButton>
    </>
  )
}

function PlanWithAddonsActions({
  handlePlanChange,
  handleCancelClick,
  subscription,
}: {
  handlePlanChange(): void
  handleCancelClick(): void
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()

  const pendingPlan = subscription.pendingPlan as PendingRecurlyPlan

  const hasAiAddon = subscription.addOns?.some(
    addOn => addOn.addOnCode === AI_ADD_ON_CODE
  )

  const pendingCancellation = Boolean(
    hasAiAddon &&
      pendingPlan &&
      !pendingPlan.addOns?.some(addOn => addOn.add_on_code === AI_ADD_ON_CODE)
  )
  return (
    <>
      <OLButton variant="secondary" onClick={handlePlanChange}>
        {t('switch_plan')}
      </OLButton>

      <>
        {!pendingCancellation && (
          <OLButton variant="danger-ghost" onClick={handleCancelClick}>
            {t('remove_add_on')}
          </OLButton>
        )}
        <CancelSubscriptionButton />
      </>
    </>
  )
}
