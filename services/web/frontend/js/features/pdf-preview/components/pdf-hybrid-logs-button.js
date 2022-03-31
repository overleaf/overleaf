import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Label, OverlayTrigger, Tooltip } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfHybridLogsButton() {
  const { error, logEntries, toggleLogs, showLogs } = useCompileContext()

  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    toggleLogs()
  }, [toggleLogs])

  const errorCount = Number(logEntries?.errors?.length)
  const warningCount = Number(logEntries?.warnings?.length)
  const totalCount = errorCount + warningCount

  return (
    <OverlayTrigger
      placement="bottom"
      overlay={
        <Tooltip id="tooltip-logs-toggle">{t('logs_and_output_files')}</Tooltip>
      }
    >
      <Button
        bsStyle="link"
        disabled={Boolean(error)}
        active={showLogs}
        className="toolbar-item log-btn"
        onClick={handleClick}
        style={{ position: 'relative' }}
        aria-label={showLogs ? t('view_pdf') : t('view_logs')}
      >
        <Icon type="file-text-o" fw />

        {!showLogs && totalCount > 0 && (
          <Label bsStyle={errorCount === 0 ? 'warning' : 'danger'}>
            {totalCount}
          </Label>
        )}
      </Button>
    </OverlayTrigger>
  )
}

export default memo(PdfHybridLogsButton)
