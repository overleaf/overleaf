import { useTranslation, Trans } from 'react-i18next'
import { CommonsPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'

type CommonsPlanProps = Pick<
  CommonsPlanSubscription,
  'subscription' | 'plan' | 'featuresPageURL'
>

function CommonsPlan({
  featuresPageURL,
  subscription,
  plan,
}: CommonsPlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel = (
    <Trans i18nKey="premium_plan_label" components={{ b: <strong /> }} />
  )

  return (
    <>
      <span className="current-plan-label visible-xs">{currentPlanLabel}</span>
      <Tooltip
        description={t('commons_plan_tooltip', {
          plan: plan.name,
          institution: subscription.name,
        })}
        id="commons-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a href={featuresPageURL} className="current-plan-label hidden-xs">
          {currentPlanLabel} <span className="info-badge" />
        </a>
      </Tooltip>
    </>
  )
}

export default CommonsPlan
