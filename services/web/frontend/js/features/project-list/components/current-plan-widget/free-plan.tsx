import { useTranslation, Trans } from 'react-i18next'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { FreePlanSubscription } from '../../../../../../types/project/dashboard/subscription'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

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

  return (
    <>
      <span
        className={classnames(
          'current-plan-label',
          bsVersion({ bs5: 'd-md-none', bs3: 'visible-xs' })
        )}
      >
        {currentPlanLabel}
      </span>
      <OLTooltip
        description={t('free_plan_tooltip')}
        id="free-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={featuresPageURL}
          className={classnames(
            'current-plan-label',
            bsVersion({ bs5: 'd-none d-md-inline-block', bs3: 'hidden-xs' })
          )}
        >
          {currentPlanLabel}&nbsp;
          <BootstrapVersionSwitcher
            bs3={<span className="info-badge" />}
            bs5={
              <MaterialIcon type="info" className="current-plan-label-icon" />
            }
          />
        </a>
      </OLTooltip>{' '}
      <span
        className={bsVersion({
          bs5: 'd-none d-md-inline-block',
          bs3: 'hidden-xs',
        })}
      >
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
