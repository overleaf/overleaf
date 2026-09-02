import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'

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

export function DisconnectedIndicatorContent() {
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-toolbar-offline-indicator">
      <MaterialIcon type="wifi_off" />
      <span>{t('disconnected')}</span>
    </div>
  )
}

function OfflineIndicatorVisual({ outOfSync }: { outOfSync: boolean }) {
  if (outOfSync) {
    return <DisconnectedIndicatorContent />
  }
  return <OfflineIndicatorContent />
}

function OfflineIndicatorStatus({ outOfSync }: { outOfSync: boolean }) {
  const { t } = useTranslation()
  if (outOfSync) {
    return <span>{t('disconnected')}</span>
  }
  return (
    <>
      <span>{t('you_re_offline')}</span>
      <span>{t('changes_saved_in_browser_sync_when_online')}</span>
    </>
  )
}

export default function OfflineIndicator({
  isOffline,
}: {
  isOffline: boolean
}) {
  const { outOfSync } = useIdeReactContext()
  // The live region div below must stay mounted at all times so screen
  // readers announce its contents when the offline state changes.
  return (
    <>
      {isOffline && <OfflineIndicatorVisual outOfSync={outOfSync} />}
      <div className="visually-hidden" role="status">
        {isOffline && <OfflineIndicatorStatus outOfSync={outOfSync} />}
      </div>
    </>
  )
}
