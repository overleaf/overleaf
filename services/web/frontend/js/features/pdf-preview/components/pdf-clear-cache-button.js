import Icon from '../../../shared/components/icon'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfClearCacheButton() {
  const { compiling, clearCache, clearingCache } = useCompileContext()

  const { t } = useTranslation()

  return (
    <Button
      bsSize="small"
      bsStyle="danger"
      className="logs-pane-actions-clear-cache"
      onClick={() => clearCache()}
      disabled={clearingCache || compiling}
    >
      {clearingCache ? <Icon type="refresh" spin /> : <Icon type="trash-o" />}
      &nbsp;
      <span>{t('clear_cached_files')}</span>
    </Button>
  )
}

export default memo(PdfClearCacheButton)
