import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '@/shared/context/project-context'
import { isSmallDevice } from '@/infrastructure/event-tracking'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

function PdfHybridDownloadButton() {
  const { pdfDownloadUrl } = useCompileContext()
  const { sendEvent } = useEditorAnalytics()

  const { projectId } = useProjectContext()

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

    sendEvent('download-pdf-button-click', {
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
        <MaterialIcon type="download" />
      </OLButton>
    </OLTooltip>
  )
}

export default PdfHybridDownloadButton
