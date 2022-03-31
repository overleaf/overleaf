import { useTranslation } from 'react-i18next'
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import { memo } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

function PdfHybridDownloadButton() {
  const { pdfDownloadUrl } = useCompileContext()

  const { t } = useTranslation()

  return (
    <OverlayTrigger
      placement="bottom"
      overlay={
        <Tooltip id="tooltip-logs-toggle">
          {pdfDownloadUrl
            ? t('download_pdf')
            : t('please_compile_pdf_before_download')}
        </Tooltip>
      }
    >
      <Button
        bsStyle="link"
        disabled={!pdfDownloadUrl}
        download
        href={pdfDownloadUrl || '#'}
        target="_blank"
        style={{ pointerEvents: 'auto' }}
      >
        <Icon type="download" fw />
      </Button>
    </OverlayTrigger>
  )
}

export default memo(PdfHybridDownloadButton)
