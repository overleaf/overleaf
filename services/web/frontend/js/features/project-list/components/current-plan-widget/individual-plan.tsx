import { useTranslation, Trans } from 'react-i18next'
import { IndividualPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'

type IndividualPlanProps = Pick<
  IndividualPlanSubscription,
  'plan' | 'remainingTrialDays'
>

function IndividualPlan({ plan, remainingTrialDays }: IndividualPlanProps) {
  const { t } = useTranslation()

  return (
    <Tooltip
      description={t('plan_tooltip', { plan: plan.name })}
      id="individual-plan"
      overlayProps={{ placement: 'bottom' }}
    >
      <a
        href="/learn/how-to/Overleaf_premium_features"
        className="current-plan-label"
      >
        {remainingTrialDays >= 0 ? (
          remainingTrialDays === 1 ? (
            <Trans i18nKey="trial_last_day" components={{ b: <strong /> }} />
          ) : (
            <Trans
              i18nKey="trial_remaining_days"
              components={{ b: <strong /> }}
              values={{ days: remainingTrialDays }}
            />
          )
        ) : (
          <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />
        )}{' '}
        <span className="info-badge" />
      </a>
    </Tooltip>
  )
}

export default IndividualPlan
