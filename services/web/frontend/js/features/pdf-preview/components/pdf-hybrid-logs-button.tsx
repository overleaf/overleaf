import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '@/shared/components/icon'
import MaterialIcon from '@/shared/components/material-icon'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLBadge from '@/features/ui/components/ol/ol-badge'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function PdfHybridLogsButton() {
  const { error, logEntries, toggleLogs, showLogs, stoppedOnFirstError } =
    useCompileContext()

  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    // only send analytics on open
    if (!showLogs) {
      eventTracking.sendMB('logs-click')
    }
    toggleLogs()
  }, [toggleLogs, showLogs])

  const errorCount = Number(logEntries?.errors?.length)
  const warningCount = Number(logEntries?.warnings?.length)
  const totalCount = errorCount + warningCount

  return (
    <OLTooltip
      id="logs-toggle"
      description={t('logs_and_output_files')}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLButton
        variant="link"
        disabled={Boolean(error || stoppedOnFirstError)}
        active={showLogs}
        className="pdf-toolbar-btn toolbar-item log-btn"
        onClick={handleClick}
        style={{ position: 'relative' }}
        aria-label={showLogs ? t('view_pdf') : t('view_logs')}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="file-text-o" fw />}
          bs5={<MaterialIcon type="description" />}
        />

        {!showLogs && totalCount > 0 && (
          <OLBadge bg={errorCount === 0 ? 'warning' : 'danger'}>
            {totalCount}
          </OLBadge>
        )}
      </OLButton>
    </OLTooltip>
  )
}

export default memo(PdfHybridLogsButton)
