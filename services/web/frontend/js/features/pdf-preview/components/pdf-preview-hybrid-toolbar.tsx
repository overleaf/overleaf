import { useLayoutContext } from '@/shared/context/layout-context'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import OLButtonToolbar from '@/shared/components/ol/ol-button-toolbar'
import PdfCompileButton from '@/features/pdf-preview/components/pdf-compile-button'
import PdfHybridDownloadButton from '@/features/pdf-preview/components/pdf-hybrid-download-button'
import { DetachedSynctexControl } from '@/features/pdf-preview/components/detach-synctex-control'
import SwitchToEditorButton from '@/features/pdf-preview/components/switch-to-editor-button'
import PdfHybridLogsButton from '@/features/pdf-preview/components/pdf-hybrid-logs-button'
import PdfPreviewHybridToolbarOrphanRefreshInner from './pdf-preview-hybrid-toolbar-orphan-refresh-inner'
import PdfPreviewHybridToolbarConnectingInner from './pdf-preview-hybrid-toolbar-connecting-inner'
import useDetachedOrphanDetection from '../hooks/use-detached-orphan-detection'

function PdfPreviewHybridToolbar() {
  const { t } = useTranslation()
  const orphanState = useDetachedOrphanDetection()

  let ToolbarContent = null
  if (orphanState === 'orphan') {
    ToolbarContent = PdfPreviewHybridToolbarOrphanRefreshInner
  } else if (orphanState === 'connecting') {
    ToolbarContent = PdfPreviewHybridToolbarConnectingInner
  } else {
    ToolbarContent = PdfPreviewHybridToolbarInner
  }

  return (
    <OLButtonToolbar
      className="toolbar toolbar-pdf toolbar-pdf-hybrid"
      aria-label={t('pdf')}
    >
      <ToolbarContent />
    </OLButtonToolbar>
  )
}

function PdfPreviewHybridToolbarInner() {
  const { focusMode } = useLayoutContext()
  return (
    <>
      <div className="toolbar-pdf-left">
        <PdfCompileButton />
        <PdfHybridLogsButton />
        <PdfHybridDownloadButton />
      </div>
      <div className="toolbar-pdf-right">
        <div className="toolbar-pdf-controls" id="toolbar-pdf-controls" />
        {!focusMode && <SwitchToEditorButton />}
        <DetachedSynctexControl />
        {/* TODO: should we have code check? */}
      </div>
    </>
  )
}

export default memo(PdfPreviewHybridToolbar)
