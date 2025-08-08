import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../../../types/subscription/plan'
import MaterialIcon from '@/shared/components/material-icon'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import OLButton from '@/shared/components/ol/ol-button'

function ChangeToPlanButton({ planCode }: { planCode: string }) {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('change-to-plan', planCode)
  }

  return (
    <OLButton variant="primary" onClick={handleClick}>
      {t('change_to_this_plan')}
    </OLButton>
  )
}

function KeepCurrentPlanButton() {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('keep-current-plan')
  }

  return (
    <OLButton variant="primary" onClick={handleClick}>
      {t('keep_current_plan')}
    </OLButton>
  )
}

function ChangePlanButton({ plan }: { plan: Plan }) {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const isCurrentPlanForUser =
    personalSubscription?.planCode &&
    plan.planCode === personalSubscription.planCode.split('_')[0]

  if (isCurrentPlanForUser && personalSubscription.pendingPlan) {
    return <KeepCurrentPlanButton />
  } else if (isCurrentPlanForUser && !personalSubscription.pendingPlan) {
    return (
      <b className="d-inline-flex align-items-center">
        <MaterialIcon type="check" />
        &nbsp;{t('your_plan')}
      </b>
    )
  } else if (
    personalSubscription?.pendingPlan?.planCode?.split('_')[0] === plan.planCode
  ) {
    return (
      <b className="d-inline-flex align-items-center">
        <MaterialIcon type="check" />
        &nbsp;{t('your_new_plan')}
      </b>
    )
  } else {
    return <ChangeToPlanButton planCode={plan.planCode} />
  }
}

function PlansRow({ plan }: { plan: Plan }) {
  const { t } = useTranslation()

  return (
    <tr>
      <td className="align-middle">
        <strong>{plan.name}</strong>
      </td>
      <td className="align-middle">
        {plan.displayPrice} / {plan.annual ? t('year') : t('month')}
      </td>
      <td className="align-middle text-center">
        <ChangePlanButton plan={plan} />
      </td>
    </tr>
  )
}

function PlansRows({ plans }: { plans: Array<Plan> }) {
  return (
    <>
      {plans &&
        plans.map(plan => (
          <PlansRow key={`plans-row-${plan.planCode}`} plan={plan} />
        ))}
    </>
  )
}

export function IndividualPlansTable({ plans }: { plans: Array<Plan> }) {
  const { t } = useTranslation()
  const { recurlyLoadError } = useSubscriptionDashboardContext()

  const filteredPlans = useMemo(
    () =>
      plans?.filter(
        plan =>
          !['paid-personal', 'paid-personal-annual'].includes(plan.planCode)
      ),
    [plans]
  )

  if (!filteredPlans || recurlyLoadError) return null

  return (
    <table className="table align-middle table-vertically-centered-cells m-0">
      <thead>
        <tr className="d-none d-md-table-row">
          <th>{t('name')}</th>
          <th>{t('price')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <PlansRows plans={filteredPlans} />
      </tbody>
    </table>
  )
}
