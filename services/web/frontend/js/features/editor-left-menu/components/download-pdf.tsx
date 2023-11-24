import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useProjectContext } from '../../../shared/context/project-context'
import Icon from '../../../shared/components/icon'
import Tooltip from '../../../shared/components/tooltip'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { isSmallDevice } from '../../../infrastructure/event-tracking'

export default function DownloadPDF() {
  const { t } = useTranslation()
  const { pdfDownloadUrl, pdfUrl } = useCompileContext()
  const { _id: projectId } = useProjectContext()

  function sendDownloadEvent() {
    eventTracking.sendMB('download-pdf-button-click', {
      projectId,
      location: 'left-menu',
      isSmallDevice,
    })
  }

  if (pdfUrl) {
    return (
      <a
        href={pdfDownloadUrl || pdfUrl}
        target="_blank"
        rel="noreferrer"
        onClick={sendDownloadEvent}
      >
        <Icon type="file-pdf-o" modifier="2x" />
        <br />
        PDF
      </a>
    )
  } else {
    return (
      <Tooltip
        id="disabled-pdf-download"
        description={t('please_compile_pdf_before_download')}
        overlayProps={{ placement: 'bottom' }}
      >
        <div className="link-disabled">
          <Icon type="file-pdf-o" modifier="2x" />
          <br />
          PDF
        </div>
      </Tooltip>
    )
  }
}
