import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Label } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
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
    <Tooltip
      id="logs-toggle"
      description={t('logs_and_output_files')}
      overlayProps={{ placement: 'bottom' }}
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
    </Tooltip>
  )
}

export default memo(PdfHybridLogsButton)
