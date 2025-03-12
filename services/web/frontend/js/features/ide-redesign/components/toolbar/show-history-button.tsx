import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCallback } from 'react'

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
        <OLButton
          size="sm"
          variant="ghost"
          className="ide-redesign-toolbar-button-subdued"
          leadingIcon={<MaterialIcon type="history" />}
          onClick={toggleHistoryOpen}
        />
      </OLTooltip>
    </div>
  )
}
