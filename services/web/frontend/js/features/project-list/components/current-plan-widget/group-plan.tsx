import { useTranslation, Trans } from 'react-i18next'
import { GroupPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

type GroupPlanProps = Pick<
  GroupPlanSubscription,
  'subscription' | 'plan' | 'remainingTrialDays' | 'featuresPageURL'
>

function GroupPlan({
  featuresPageURL,
  subscription,
  plan,
  remainingTrialDays,
}: GroupPlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel =
    remainingTrialDays >= 0 ? (
      remainingTrialDays === 1 ? (
        <Trans i18nKey="trial_last_day" components={{ b: <strong /> }} />
      ) : (
        <Trans
          i18nKey="trial_remaining_days"
          components={{ b: <strong /> }}
          values={{ days: remainingTrialDays }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      )
    ) : (
      <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />
    )

  return (
    <>
      <span className="current-plan-label d-md-none">{currentPlanLabel}</span>
      <OLTooltip
        description={
          subscription.teamName != null
            ? t('group_plan_with_name_tooltip', {
                plan: plan.name,
                groupName: subscription.teamName,
              })
            : t('group_plan_tooltip', { plan: plan.name })
        }
        id="group-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className="current-plan-label d-none d-md-inline-block"
        >
          {currentPlanLabel}&nbsp;
          <MaterialIcon type="info" className="current-plan-label-icon" />
        </a>
      </OLTooltip>
    </>
  )
}

export default GroupPlan
