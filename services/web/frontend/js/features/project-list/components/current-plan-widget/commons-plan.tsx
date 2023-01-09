import { useTranslation, Trans } from 'react-i18next'
import { CommonsPlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'
import getMeta from '../../../../utils/meta'
import * as eventTracking from '../../../../infrastructure/event-tracking'

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
        description={t('commons_plan_tooltip', {
          plan: plan.name,
          institution: subscription.name,
        })}
        id="commons-plan"
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

export default CommonsPlan
