import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'

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
      className="toolbar-header-upgrade-prompt"
      href="/user/subscription/plans?itm_referrer=editor-header-upgrade-prompt"
      target="_blank"
      onClick={handleClick}
    >
      {t('upgrade')}
    </OLButton>
  )
}

export default UpgradePrompt
