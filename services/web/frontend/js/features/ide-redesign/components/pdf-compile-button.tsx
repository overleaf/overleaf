import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

function PdfCompileButton() {
  const { compiling, startCompile } = useCompileContext()
  const { t } = useTranslation()

  return (
    <OLTooltip
      id="download-pdf"
      description={compiling ? t('compiling') : t('recompile')}
      overlayProps={{ placement: 'bottom' }}
    >
      {/* TODO: add some indicator that changes have been made */}
      <OLButton
        onClick={startCompile}
        variant="link"
        className="pdf-toolbar-btn"
        isLoading={compiling}
        style={{ pointerEvents: 'auto' }}
        aria-label={t('download_pdf')}
      >
        <MaterialIcon type="refresh" />
      </OLButton>
    </OLTooltip>
  )
}

export default memo(PdfCompileButton)
