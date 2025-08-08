import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfClearCacheButton() {
  const { compiling, clearCache, clearingCache } = useCompileContext()

  const { t } = useTranslation()

  return (
    <OLButton
      size="sm"
      variant="danger"
      className="logs-pane-actions-clear-cache"
      onClick={() => clearCache()}
      isLoading={clearingCache}
      disabled={clearingCache || compiling}
      leadingIcon="delete"
      loadingLabel={t('clear_cached_files')}
    >
      <span>{t('clear_cached_files')}</span>
    </OLButton>
  )
}

export default memo(PdfClearCacheButton)
