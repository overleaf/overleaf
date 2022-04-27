import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../infrastructure/event-tracking'

function UpgradePrompt() {
  const { t } = useTranslation()

  function handleClick(e) {
    eventTracking.send('subscription-funnel', 'code-editor', 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source: 'code-editor' })
  }

  return (
    <a
      className="toolbar-header-upgrade-prompt btn btn-primary btn-xs"
      href="/user/subscription/plans"
      target="_blank"
      onClick={handleClick}
    >
      {t('upgrade')}
    </a>
  )
}

export default UpgradePrompt
