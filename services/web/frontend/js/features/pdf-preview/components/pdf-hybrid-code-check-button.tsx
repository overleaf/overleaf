import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'

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
    <OLButton
      variant="danger"
      size="sm"
      disabled={Boolean(error)}
      className="btn-toggle-logs toolbar-item"
      onClick={handleClick}
    >
      <MaterialIcon type="warning" />
      <span className="toolbar-text">{t('code_check_failed')}</span>
    </OLButton>
  )
}

export default memo(PdfHybridCodeCheckButton)
