import { ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
} from 'react-resizable-panels'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useLayoutContext } from '@/shared/context/layout-context'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'
import { DefaultSynctexControl } from '@/features/pdf-preview/components/detach-synctex-control'
import classnames from 'classnames'

export type EditorProps = {
  shouldPersistLayout?: boolean
  editorContent: ReactNode
}

export default function EditorAndPdf({
  shouldPersistLayout = false,
  editorContent,
}: EditorProps) {
  const { t } = useTranslation()
  const { view, pdfLayout, changeLayout } = useLayoutContext()

  const pdfPanelRef = useRef<ImperativePanelHandle>(null)
  const isDualPane = pdfLayout === 'sideBySide'
  const editorIsVisible = isDualPane || view === 'editor'
  const pdfIsOpen = isDualPane || view === 'pdf'

  useCollapsiblePanel(pdfIsOpen, pdfPanelRef)

  const historyIsOpen = view === 'history'

  function setPdfIsOpen(isOpen: boolean) {
    if (isOpen) {
      changeLayout('sideBySide')
    } else {
      changeLayout('flat', 'editor')
    }
  }

  return (
    <PanelGroup
      autoSaveId={
        shouldPersistLayout ? 'ide-react-editor-and-pdf-layout' : undefined
      }
      direction="horizontal"
      className={classnames({ hide: historyIsOpen })}
    >
      {editorIsVisible ? (
        <Panel
          id="editor"
          order={1}
          defaultSize={50}
          className="ide-react-panel"
        >
          {editorContent}
        </Panel>
      ) : null}
      <HorizontalResizeHandle resizable={isDualPane}>
        <HorizontalToggler
          id="editor-pdf"
          togglerType="east"
          isOpen={pdfIsOpen}
          setIsOpen={isOpen => setPdfIsOpen(isOpen)}
          tooltipWhenOpen={t('tooltip_hide_pdf')}
          tooltipWhenClosed={t('tooltip_show_pdf')}
        />
        {isDualPane ? (
          <div className="synctex-controls">
            <DefaultSynctexControl />
          </div>
        ) : null}
      </HorizontalResizeHandle>
      {pdfIsOpen ? (
        <Panel
          ref={pdfPanelRef}
          id="pdf"
          order={2}
          defaultSize={50}
          minSize={5}
          collapsible
          onCollapse={collapsed => setPdfIsOpen(!collapsed)}
          className="ide-react-panel"
        >
          <PdfPreview />
        </Panel>
      ) : null}
    </PanelGroup>
  )
}
