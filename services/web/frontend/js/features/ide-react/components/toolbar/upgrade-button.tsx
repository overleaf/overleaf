import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
  const plans2026 = useFeatureFlag('plans-2026-phase-1')

  function handleClick() {
    eventTracking.send('subscription-funnel', source, 'upgrade')
    eventTracking.sendMB('upgrade-button-click', { source })
  }

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLButton
        variant="premium"
        size="sm"
        href={
          plans2026
            ? `/user/subscription/choose-your-plan?itm_referrer=${referrer}&paywall-type=${source}`
            : `/user/subscription/plans?itm_referrer=${referrer}`
        }
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
