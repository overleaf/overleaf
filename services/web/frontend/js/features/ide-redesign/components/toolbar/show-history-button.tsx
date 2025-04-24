import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'

export default function ShowHistoryButton() {
  const { t } = useTranslation()
  const { view, setView } = useLayoutContext()

  const toggleHistoryOpen = useCallback(() => {
    const action = view === 'history' ? 'close' : 'open'
    eventTracking.sendMB('navigation-clicked-history', { action })

    setView(view === 'history' ? 'editor' : 'history')
  }, [view, setView])

  return (
    <div className="ide-redesign-toolbar-button-container">
      <OLTooltip
        id="tooltip-open-history"
        description={t('history')}
        overlayProps={{ delay: 0, placement: 'bottom' }}
      >
        <OLIconButton
          icon="history"
          className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
          onClick={toggleHistoryOpen}
          accessibilityLabel={t('history')}
        />
      </OLTooltip>
    </div>
  )
}
