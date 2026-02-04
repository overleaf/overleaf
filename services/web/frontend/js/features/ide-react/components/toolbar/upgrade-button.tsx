import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'

export default function UpgradeButton() {
  const { t } = useTranslation()

  function handleClick() {
    eventTracking.send('subscription-funnel', 'code-editor', 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source: 'code-editor' })
  }

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLButton
        variant="premium"
        size="sm"
        href="/user/subscription/plans?itm_referrer=editor-header-upgrade-prompt"
        target="_blank"
        onClick={handleClick}
      >
        {t('upgrade')}
      </OLButton>
    </div>
  )
}
