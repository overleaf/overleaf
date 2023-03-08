import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../../../types/subscription/plan'
import Icon from '../../../../../../../shared/components/icon'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'

function ChangeToPlanButton({ planCode }: { planCode: string }) {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('change-to-plan', planCode)
  }

  return (
    <button className="btn btn-primary" onClick={handleClick}>
      {t('change_to_this_plan')}
    </button>
  )
}

function KeepCurrentPlanButton({ plan }: { plan: Plan }) {
  const { t } = useTranslation()
  const { handleOpenModal } = useSubscriptionDashboardContext()

  const handleClick = () => {
    handleOpenModal('keep-current-plan')
  }

  return (
    <button className="btn btn-primary" onClick={handleClick}>
      {t('keep_current_plan')}
    </button>
  )
}

function ChangePlanButton({ plan }: { plan: Plan }) {
  const { t } = useTranslation()
  const { personalSubscription } = useSubscriptionDashboardContext()
  const isCurrentPlanForUser =
    personalSubscription?.planCode &&
    plan.planCode === personalSubscription.planCode.split('_')[0]

  if (isCurrentPlanForUser && personalSubscription.pendingPlan) {
    return <KeepCurrentPlanButton plan={plan} />
  } else if (isCurrentPlanForUser && !personalSubscription.pendingPlan) {
    return (
      <b>
        <Icon type="check" /> {t('your_plan')}
      </b>
    )
  } else if (
    personalSubscription?.pendingPlan?.planCode?.split('_')[0] === plan.planCode
  ) {
    return (
      <b>
        <Icon type="check" /> {t('your_new_plan')}
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
      <td>
        <strong>{plan.name}</strong>
      </td>
      <td>
        {plan.displayPrice} / {plan.annual ? t('year') : t('month')}
      </td>
      <td>
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

  if (!plans || recurlyLoadError) return null

  return (
    <table className="table table-vertically-centered-cells">
      <thead>
        <tr>
          <th>{t('name')}</th>
          <th>{t('price')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <PlansRows plans={plans} />
      </tbody>
    </table>
  )
}
