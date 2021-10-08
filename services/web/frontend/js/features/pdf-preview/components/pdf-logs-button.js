import { memo, useCallback, useMemo } from 'react'
import { Button } from 'react-bootstrap'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { PdfLogsButtonContent } from './pdf-logs-button-content'
import { sendMBOnce } from '../../../infrastructure/event-tracking'

function PdfLogsButton() {
  const {
    codeCheckFailed,
    error,
    logEntries,
    showLogs,
    setShowLogs,
  } = usePdfPreviewContext()

  const buttonStyle = useMemo(() => {
    if (showLogs) {
      return 'default'
    }

    if (codeCheckFailed) {
      return 'danger'
    }

    if (logEntries) {
      if (logEntries.errors?.length) {
        return 'danger'
      }

      if (logEntries.warnings?.length) {
        return 'warning'
      }
    }

    return 'default'
  }, [codeCheckFailed, logEntries, showLogs])

  const handleClick = useCallback(() => {
    setShowLogs(value => {
      if (!value) {
        sendMBOnce('ide-open-logs-once')
      }

      return !value
    })
  }, [setShowLogs])

  return (
    <Button
      bsSize="xsmall"
      bsStyle={buttonStyle}
      disabled={Boolean(error)}
      className="btn-toggle-logs toolbar-item"
      onClick={handleClick}
    >
      <PdfLogsButtonContent
        showLogs={showLogs}
        logEntries={logEntries}
        codeCheckFailed={codeCheckFailed}
      />
    </Button>
  )
}

export default memo(PdfLogsButton)
