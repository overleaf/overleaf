import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { FreePlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import Tooltip from '../../../../shared/components/tooltip'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'

type FreePlanProps = Pick<FreePlanSubscription, 'featuresPageURL'>

function FreePlan({ featuresPageURL }: FreePlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel = (
    <Trans i18nKey="free_plan_label" components={{ b: <strong /> }} />
  )

  const handleClick = () => {
    eventTracking.sendMB('upgrade-button-click', {
      source: 'dashboard-top',
      'project-dashboard-react': 'enabled',
      'is-dashboard-sidebar-hidden': false,
      'is-screen-width-less-than-768px': false,
    })
  }

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
        description={t('free_plan_tooltip')}
        id="free-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className="current-plan-label hidden-xs"
          onClick={handleLinkClick}
        >
          {currentPlanLabel} <span className="info-badge" />
        </a>
      </Tooltip>{' '}
      <Button
        bsStyle="primary"
        className="hidden-xs"
        href="/user/subscription/plans"
        onClick={handleClick}
      >
        {t('upgrade')}
      </Button>
    </>
  )
}

export default FreePlan
