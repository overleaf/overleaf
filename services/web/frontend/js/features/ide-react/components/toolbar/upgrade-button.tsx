import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'

export default function UpgradeButton({
  className = '',
  referrer = 'editor-header-upgrade-prompt',
  source = 'code-editor',
}: {
  className?: string
  referrer?: string
  source?: string
}) {
  const { t } = useTranslation()

  function handleClick() {
    eventTracking.send('subscription-funnel', source, 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source })
  }

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLButton
        variant="premium"
        size="sm"
        href={`/user/subscription/plans?itm_referrer=${referrer}`}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
        className={className}
      >
        {t('upgrade')}
      </OLButton>
    </div>
  )
}
