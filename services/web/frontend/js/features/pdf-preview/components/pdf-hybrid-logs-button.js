import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Label, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { sendMBOnce } from '../../../infrastructure/event-tracking'
import Icon from '../../../shared/components/icon'
import { useCompileContext } from '../../../shared/context/compile-context'

function PdfHybridLogsButton() {
  const { error, logEntries, setShowLogs, showLogs } = useCompileContext()

  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    setShowLogs(value => {
      if (!value) {
        sendMBOnce('ide-open-logs-once')
      }

      return !value
    })
  }, [setShowLogs])

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
        <Icon type="file-text-o" modifier="fw" />

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
