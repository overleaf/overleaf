import { useTranslation, Trans } from 'react-i18next'
import { CommonsPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

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
      <span className="current-plan-label d-md-none">{currentPlanLabel}</span>
      <OLTooltip
        description={t('commons_plan_tooltip', {
          plan: plan.name,
          institution: subscription.name,
        })}
        id="commons-plan"
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

export default CommonsPlan
