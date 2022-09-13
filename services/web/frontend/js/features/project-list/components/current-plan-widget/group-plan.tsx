import { useTranslation, Trans } from 'react-i18next'
import { GroupPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'

type GroupPlanProps = Pick<
  GroupPlanSubscription,
  'subscription' | 'plan' | 'remainingTrialDays'
>

function GroupPlan({ subscription, plan, remainingTrialDays }: GroupPlanProps) {
  const { t } = useTranslation()

  return (
    <Tooltip
      description={t(
        subscription.teamName != null
          ? 'group_plan_with_name_tooltip'
          : 'group_plan_tooltip',
        { plan: plan.name, groupName: subscription.teamName }
      )}
      id="group-plan"
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

export default GroupPlan
