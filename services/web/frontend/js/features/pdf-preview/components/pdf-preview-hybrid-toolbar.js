import { memo } from 'react'
import { ButtonToolbar } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '../../../shared/context/layout-context'
import PdfCompileButton from './pdf-compile-button'
import PdfExpandButton from './pdf-expand-button'
import PdfHybridLogsButton from './pdf-hybrid-logs-button'
import PdfHybridDownloadButton from './pdf-hybrid-download-button'
import PdfHybridCodeCheckButton from './pdf-hybrid-code-check-button'
import PdfOrphanRefreshButton from './pdf-orphan-refresh-button'

function PdfPreviewHybridToolbar() {
  const { detachMode } = useLayoutContext()

  return (
    <ButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
      {detachMode === 'orphan' ? (
        <PdfPreviewHybridToolbarOrphanInner />
      ) : (
        <PdfPreviewHybridToolbarInner />
      )}
    </ButtonToolbar>
  )
}

function PdfPreviewHybridToolbarInner() {
  return (
    <>
      <div className="toolbar-pdf-left">
        <PdfCompileButton />
        <PdfHybridLogsButton />
        <PdfHybridDownloadButton />
      </div>
      <div className="toolbar-pdf-right">
        <PdfHybridCodeCheckButton />
        {!window.showPdfDetach && <PdfExpandButton />}
      </div>
    </>
  )
}

function PdfPreviewHybridToolbarOrphanInner() {
  const { t } = useTranslation()
  return (
    <>
      <div className="toolbar-pdf-orphan">
        {t('tab_no_longer_connected')}
        <PdfOrphanRefreshButton />
      </div>
    </>
  )
}

export default memo(PdfPreviewHybridToolbar)
