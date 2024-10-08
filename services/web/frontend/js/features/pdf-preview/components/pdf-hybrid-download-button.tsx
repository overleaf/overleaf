import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '@/shared/context/project-context'
import { sendMB, isSmallDevice } from '@/infrastructure/event-tracking'
import Icon from '@/shared/components/icon'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

function PdfHybridDownloadButton() {
  const { pdfDownloadUrl } = useCompileContext()

  const { _id: projectId } = useProjectContext()

  const { t } = useTranslation()
  const description = pdfDownloadUrl
    ? t('download_pdf')
    : t('please_compile_pdf_before_download')

  function handleOnClick(e: React.MouseEvent) {
    const event = e as React.MouseEvent<HTMLAnchorElement>
    if (event.currentTarget.dataset.disabled === 'true') {
      event.preventDefault()
      return
    }

    sendMB('download-pdf-button-click', {
      projectId,
      location: 'pdf-preview',
      isSmallDevice,
    })
  }

  return (
    <OLTooltip
      id="download-pdf"
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      <OLButton
        onClick={handleOnClick}
        variant="link"
        className="pdf-toolbar-btn"
        draggable={false}
        data-disabled={!pdfDownloadUrl}
        disabled={!pdfDownloadUrl}
        download
        href={pdfDownloadUrl || '#'}
        target="_blank"
        style={{ pointerEvents: 'auto' }}
        aria-label={t('download_pdf')}
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="download" fw />}
          bs5={<MaterialIcon type="download" />}
        />
      </OLButton>
    </OLTooltip>
  )
}

export default PdfHybridDownloadButton
