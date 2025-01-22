import { Trans, useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type PausedPlanProps = {
  subscriptionPageUrl: string
}

function PausedPlan({ subscriptionPageUrl }: PausedPlanProps) {
  const { t } = useTranslation()
  const currentPlanLabel = (
    <Trans
      i18nKey="your_premium_plan_is_paused"
      components={[
        // eslint-disable-next-line react/jsx-key
        <strong />,
      ]}
    />
  )

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
        description={t('click_to_unpause')}
        id="individual-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={subscriptionPageUrl}
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
      </OLTooltip>
    </>
  )
}

export default PausedPlan
