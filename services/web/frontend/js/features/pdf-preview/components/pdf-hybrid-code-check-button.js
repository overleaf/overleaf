import { memo, useCallback } from 'react'
import { usePdfPreviewContext } from '../contexts/pdf-preview-context'
import { sendMBOnce } from '../../../infrastructure/event-tracking'
import { Button } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

function PdfHybridCodeCheckButton() {
  const { codeCheckFailed, error, setShowLogs } = usePdfPreviewContext()

  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    setShowLogs(value => {
      if (!value) {
        sendMBOnce('ide-open-logs-once')
      }

      return !value
    })
  }, [setShowLogs])

  if (!codeCheckFailed) {
    return null
  }

  return (
    <Button
      bsSize="xsmall"
      bsStyle="danger"
      disabled={Boolean(error)}
      className="btn-toggle-logs toolbar-item"
      onClick={handleClick}
    >
      <Icon type="exclamation-triangle" />
      <span className="toolbar-text toolbar-hide-small">
        {t('code_check_failed')}
      </span>
    </Button>
  )
}

export default memo(PdfHybridCodeCheckButton)
