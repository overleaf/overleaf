import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

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

export default function OfflineIndicator({
  isOffline,
}: {
  isOffline: boolean
}) {
  const { t } = useTranslation()
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
