import { memo, useCallback } from 'react'
import { Button } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfHybridCodeCheckButton() {
  const { codeCheckFailed, error, toggleLogs } = useCompileContext()

  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    toggleLogs()
  }, [toggleLogs])

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
