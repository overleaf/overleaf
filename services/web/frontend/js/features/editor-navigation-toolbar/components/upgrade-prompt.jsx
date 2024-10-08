import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'
import { bsVersion } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

function UpgradePrompt() {
  const { t } = useTranslation()

  function handleClick(e) {
    eventTracking.send('subscription-funnel', 'code-editor', 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source: 'code-editor' })
  }

  return (
    <OLButton
      variant="primary"
      size="sm"
      className={classnames(
        'toolbar-header-upgrade-prompt',
        bsVersion({ bs3: 'btn-xs' })
      )}
      href="/user/subscription/plans?itm_referrer=editor-header-upgrade-prompt"
      target="_blank"
      onClick={handleClick}
    >
      {t('upgrade')}
    </OLButton>
  )
}

export default UpgradePrompt
