import { memo } from 'react'
import OlButtonToolbar from '@/features/ui/components/ol/ol-button-toolbar'
import PdfCompileButton from '@/features/pdf-preview/components/pdf-compile-button'
import PdfHybridDownloadButton from '@/features/pdf-preview/components/pdf-hybrid-download-button'
import { DetachedSynctexControl } from '@/features/pdf-preview/components/detach-synctex-control'
import SwitchToEditorButton from '@/features/pdf-preview/components/switch-to-editor-button'

function PdfPreviewHybridToolbar() {
  // TODO: add detached pdf logic
  return (
    <OlButtonToolbar className="toolbar toolbar-pdf toolbar-pdf-hybrid">
      <div className="toolbar-pdf-left">
        <PdfCompileButton />
        <PdfHybridDownloadButton />
      </div>
      <div className="toolbar-pdf-right">
        <div className="toolbar-pdf-controls" id="toolbar-pdf-controls" />
        <SwitchToEditorButton />
        <DetachedSynctexControl />
        {/* TODO: should we have code check? */}
      </div>
    </OlButtonToolbar>
  )
}

export default memo(PdfPreviewHybridToolbar)
