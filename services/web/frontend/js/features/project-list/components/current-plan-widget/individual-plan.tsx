import { useTranslation, Trans } from 'react-i18next'
import { IndividualPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'
import getMeta from '../../../../utils/meta'
import * as eventTracking from '../../../../infrastructure/event-tracking'

type IndividualPlanProps = Pick<
  IndividualPlanSubscription,
  'plan' | 'remainingTrialDays' | 'featuresPageURL'
>

function IndividualPlan({
  featuresPageURL,
  plan,
  remainingTrialDays,
}: IndividualPlanProps) {
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
        />
      )
    ) : (
      <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />
    )

  const featuresPageVariant = getMeta('ol-splitTestVariants')?.['features-page']
  function handleLinkClick() {
    eventTracking.sendMB('features-page-link', {
      splitTest: 'features-page',
      splitTestVariant: featuresPageVariant,
    })
  }

  return (
    <>
      <span className="current-plan-label visible-xs">{currentPlanLabel}</span>
      <Tooltip
        description={t('plan_tooltip', { plan: plan.name })}
        id="individual-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className="current-plan-label hidden-xs"
          onClick={handleLinkClick}
        >
          {currentPlanLabel} <span className="info-badge" />
        </a>
      </Tooltip>
    </>
  )
}

export default IndividualPlan
