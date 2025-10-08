import { useTranslation } from 'react-i18next'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

export default function ShowHistoryButton() {
  const { t } = useTranslation()
  const { view, setView, restoreView } = useLayoutContext()
  const { sendEvent } = useEditorAnalytics()

  const toggleHistoryOpen = useCallback(() => {
    const action = view === 'history' ? 'close' : 'open'
    sendEvent('navigation-clicked-history', { action })
    if (view === 'history') {
      restoreView()
    } else {
      setView('history')
    }
  }, [view, setView, sendEvent, restoreView])

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
