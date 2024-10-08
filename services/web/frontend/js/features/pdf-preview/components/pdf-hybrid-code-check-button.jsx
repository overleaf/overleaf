import { memo, useCallback } from 'react'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { bsVersion } from '@/features/utils/bootstrap-5'

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
      bs3Props={{
        bsSize: 'xsmall',
      }}
    >
      <BootstrapVersionSwitcher
        bs3={<Icon type="exclamation-triangle" />}
        bs5={<MaterialIcon type="warning" />}
      />
      <span className={bsVersion({ bs3: 'toolbar-text' })}>
        {t('code_check_failed')}
      </span>
    </OLButton>
  )
}

export default memo(PdfHybridCodeCheckButton)
