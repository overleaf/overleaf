import { useTranslation, Trans } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import { FreePlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import * as eventTracking from '../../../../infrastructure/event-tracking'

type FreePlanProps = Pick<FreePlanSubscription, 'featuresPageURL'>

function FreePlan({ featuresPageURL }: FreePlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel = (
    <Trans
      i18nKey="free_plan_label"
      components={{ b: <strong translate="no" /> }}
    />
  )

  const handleClick = () => {
    eventTracking.sendMB('upgrade-button-click', {
      source: 'dashboard-top',
      'project-dashboard-react': 'enabled',
      'is-dashboard-sidebar-hidden': false,
      'is-screen-width-less-than-768px': false,
    })
  }

  return (
    <>
      <span className="current-plan-label d-md-none">{currentPlanLabel}</span>
      <OLTooltip
        description={t('free_plan_tooltip')}
        id="free-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className="current-plan-label d-none d-md-inline-block"
        >
          {currentPlanLabel}&nbsp;
          <MaterialIcon type="info" className="current-plan-label-icon" />
        </a>
      </OLTooltip>{' '}
      <span className="d-none d-md-inline-block">
        <OLButton
          variant="primary"
          href="/user/subscription/plans"
          onClick={handleClick}
        >
          {t('upgrade')}
        </OLButton>
      </span>
    </>
  )
}

export default FreePlan
