import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useUnsavedDocsContext } from '@/features/ide-react/context/unsaved-docs-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function OfflineIndicatorContent() {
  const { t } = useTranslation()
  return (
    <OLTooltip
      id="tooltip-offline-indicator"
      description={t('changes_saved_in_browser_sync_when_online')}
      overlayProps={{ delay: 0, placement: 'bottom' }}
    >
      <div className="ide-redesign-toolbar-offline-indicator">
        <MaterialIcon type="wifi_off" />
        <span>{t('you_re_offline')}</span>
      </div>
    </OLTooltip>
  )
}

export default function OfflineIndicator() {
  const { t } = useTranslation()
  const { unsavedDocs } = useUnsavedDocsContext()
  const improvedFlakyConnections = useFeatureFlag(
    'intermittent-connection-improvements'
  )

  if (!improvedFlakyConnections) {
    return null
  }

  // TODO: use shared hook for this when merged
  const MAX_UNSAVED_ALERT_SECONDS = 15
  const isOffline = [...unsavedDocs.values()].some(
    seconds => seconds >= MAX_UNSAVED_ALERT_SECONDS
  )
  return (
    <>
      {isOffline && <OfflineIndicatorContent />}
      <div className="visually-hidden" role="status">
        {isOffline && (
          <>
            <span>{t('you_re_offline')}</span>
            <span>{t('changes_saved_in_browser_sync_when_online')}</span>
          </>
        )}
      </div>
    </>
  )
}
