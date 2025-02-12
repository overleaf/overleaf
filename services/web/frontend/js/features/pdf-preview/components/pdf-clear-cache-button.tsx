import Icon from '../../../shared/components/icon'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
    >
      <BootstrapVersionSwitcher
        bs3={
          <>
            {clearingCache ? (
              <Icon type="refresh" spin />
            ) : (
              <Icon type="trash-o" />
            )}
            &nbsp;
          </>
        }
      />
      <span>{t('clear_cached_files')}</span>
    </OLButton>
  )
}

export default memo(PdfClearCacheButton)
