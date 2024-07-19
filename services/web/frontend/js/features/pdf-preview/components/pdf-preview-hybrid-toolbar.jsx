import { memo, useState, useEffect, useRef } from 'react'
import { ButtonToolbar } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '../../../shared/context/layout-context'
import PdfCompileButton from './pdf-compile-button'
import SwitchToEditorButton from './switch-to-editor-button'
import PdfHybridLogsButton from './pdf-hybrid-logs-button'
import PdfHybridDownloadButton from './pdf-hybrid-download-button'
import PdfHybridCodeCheckButton from './pdf-hybrid-code-check-button'
import PdfOrphanRefreshButton from './pdf-orphan-refresh-button'
import { DetachedSynctexControl } from './detach-synctex-control'
import Icon from '../../../shared/components/icon'

const ORPHAN_UI_TIMEOUT_MS = 5000

function PdfPreviewHybridToolbar() {
  const { detachRole, detachIsLinked } = useLayoutContext()

  const uiTimeoutRef = useRef()
  const [orphanPdfTabAfterDelay, setOrphanPdfTabAfterDelay] = useState(false)

  const orphanPdfTab = !detachIsLinked && detachRole === 'detached'

  useEffect(() => {
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current)
    }

    if (orphanPdfTab) {
      uiTimeoutRef.current = setTimeout(() => {
        setOrphanPdfTabAfterDelay(true)
      }, ORPHAN_UI_TIMEOUT_MS)
    } else {
      setOrphanPdfTabAfterDelay(false)
    }
  }, [orphanPdfTab])

  let ToolbarInner = null
  if (orphanPdfTabAfterDelay) {
    // when the detached tab has been orphan for a while
    ToolbarInner = <PdfPreviewHybridToolbarOrphanInner />
  } else if (orphanPdfTab) {
    ToolbarInner = <PdfPreviewHybridToolbarConnectingInner />
  } else {
    // tab is not detached or not orphan
    ToolbarInner = <PdfPreviewHybridToolbarInner />
  }

  return (
    <ButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
      {ToolbarInner}
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
        <div className="toolbar-pdf-controls" id="toolbar-pdf-controls" />
        <PdfHybridCodeCheckButton />
        <SwitchToEditorButton />
        <DetachedSynctexControl />
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

function PdfPreviewHybridToolbarConnectingInner() {
  const { t } = useTranslation()
  return (
    <>
      <div className="toolbar-pdf-orphan">
        <Icon type="refresh" fw spin />
        {t('tab_connecting')}…
      </div>
    </>
  )
}

export default memo(PdfPreviewHybridToolbar)
