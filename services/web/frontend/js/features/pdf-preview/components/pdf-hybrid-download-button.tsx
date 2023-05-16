import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '../../../shared/context/project-context'
import * as eventTracking from '../../../infrastructure/event-tracking'

function PdfHybridDownloadButton() {
  const { pdfDownloadUrl } = useCompileContext()

  const { _id: projectId } = useProjectContext()

  const { t } = useTranslation()
  const description = pdfDownloadUrl
    ? t('download_pdf')
    : t('please_compile_pdf_before_download')

  function handleOnClick() {
    eventTracking.sendMB('download-pdf-button-click', { projectId })
  }

  return (
    <Tooltip
      id="download-pdf"
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      <Button
        onClick={handleOnClick}
        bsStyle="link"
        disabled={!pdfDownloadUrl}
        download
        href={pdfDownloadUrl || '#'}
        target="_blank"
        style={{ pointerEvents: 'auto' }}
      >
        <Icon type="download" fw />
      </Button>
    </Tooltip>
  )
}

export default PdfHybridDownloadButton
