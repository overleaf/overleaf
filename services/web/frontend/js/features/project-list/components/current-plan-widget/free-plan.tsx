import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../../shared/components/tooltip'
import * as eventTracking from '../../../../infrastructure/event-tracking'

function FreePlan() {
  const { t } = useTranslation()

  function handleClick() {
    eventTracking.send('subscription-funnel', 'dashboard-top', 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source: 'dashboard-top' })
  }

  return (
    <>
      <Tooltip
        description={t('free_plan_tooltip')}
        id="free-plan"
        overlayProps={{ placement: 'bottom' }}
      >
        <a
          href="/learn/how-to/Overleaf_premium_features"
          className="current-plan-label"
        >
          <Trans i18nKey="free_plan_label" components={{ b: <strong /> }} />{' '}
          <span className="info-badge" />
        </a>
      </Tooltip>{' '}
      <Button
        bsStyle="primary"
        href="/user/subscription/plans"
        onClick={handleClick}
      >
        {t('upgrade')}
      </Button>
    </>
  )
}

export default FreePlan
