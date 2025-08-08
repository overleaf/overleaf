import { useTranslation, Trans } from 'react-i18next'
import { GroupPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

type GroupPlanProps = Pick<
  GroupPlanSubscription,
  'subscription' | 'plan' | 'remainingTrialDays' | 'featuresPageURL'
>

function getFriendlyPlanName(planName: string): string {
  if (planName.toLowerCase().includes('professional')) {
    return 'Professional'
  } else if (planName.toLowerCase().includes('collaborator')) {
    return 'Standard'
  }
  // fallback on plan name
  else {
    return planName
  }
}

function GroupPlan({
  featuresPageURL,
  subscription,
  plan,
  remainingTrialDays,
}: GroupPlanProps) {
  const { t } = useTranslation()
  const planNameComponent = <strong translate="no" />
  const friendlyPlanName = getFriendlyPlanName(plan.name)
  const currentPlanLabel =
    remainingTrialDays >= 0 ? (
      remainingTrialDays === 1 ? (
        <Trans i18nKey="trial_last_day" components={{ b: planNameComponent }} />
      ) : (
        <Trans
          i18nKey="trial_remaining_days"
          components={{ b: planNameComponent }}
          values={{ days: remainingTrialDays }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      )
    ) : (
      <Trans
        i18nKey="premium_plan_label"
        components={{ b: planNameComponent }}
      />
    )

  return (
    <>
      <span className="current-plan-label d-md-none">{currentPlanLabel}</span>
      <OLTooltip
        description={
          subscription.teamName != null
            ? t('group_plan_with_name_tooltip', {
                plan: friendlyPlanName,
                groupName: subscription.teamName,
              })
            : t('group_plan_tooltip', { plan: friendlyPlanName })
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
