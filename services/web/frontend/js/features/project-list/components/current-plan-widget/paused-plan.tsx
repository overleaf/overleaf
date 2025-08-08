import { Trans, useTranslation } from 'react-i18next'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

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
        <strong translate="no" />,
      ]}
    />
  )

  return (
    <>
      <span className="current-plan-label d-md-none">{currentPlanLabel}</span>
      <OLTooltip
        description={t('click_to_unpause')}
        id="individual-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href={subscriptionPageUrl}
          className="current-plan-label d-none d-md-inline-block"
        >
          {currentPlanLabel}&nbsp;
          <MaterialIcon type="info" className="current-plan-label-icon" />
        </a>
      </OLTooltip>
    </>
  )
}

export default PausedPlan
