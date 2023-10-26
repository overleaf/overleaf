import { useRef } from 'react'
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
import { EditorPane } from '@/features/ide-react/components/editor/editor-pane'
import PlaceholderFile from '@/features/ide-react/components/layout/placeholder/placeholder-file'
import PlaceholderPdf from '@/features/ide-react/components/layout/placeholder/placeholder-pdf'

export type EditorProps = {
  shouldPersistLayout?: boolean
  openDocId: string | null
  fileTreeReady: boolean
}

export default function Editor({
  shouldPersistLayout = false,
  openDocId,
  fileTreeReady,
}: EditorProps) {
  const { t } = useTranslation()
  const { view, pdfLayout, changeLayout } = useLayoutContext()

  const pdfPanelRef = useRef<ImperativePanelHandle>(null)
  const isDualPane = pdfLayout === 'sideBySide'
  const editorIsVisible = isDualPane || view === 'editor'
  const pdfIsOpen = isDualPane || view === 'pdf'

  useCollapsiblePanel(pdfIsOpen, pdfPanelRef)

  if (view === 'file') {
    return <PlaceholderFile />
  }

  if (view === 'history') {
    return null
  }

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
    >
      {editorIsVisible ? (
        <Panel id="editor" order={1} defaultSize={50}>
          <EditorPane
            shouldPersistLayout={shouldPersistLayout}
            openDocId={openDocId}
            fileTreeReady={fileTreeReady}
          />
        </Panel>
      ) : null}
      {isDualPane ? (
        <HorizontalResizeHandle>
          <HorizontalToggler
            id="editor-pdf"
            togglerType="east"
            isOpen={pdfIsOpen}
            setIsOpen={isOpen => setPdfIsOpen(isOpen)}
            tooltipWhenOpen={t('tooltip_hide_pdf')}
            tooltipWhenClosed={t('tooltip_show_pdf')}
          />
        </HorizontalResizeHandle>
      ) : null}
      {pdfIsOpen ? (
        <Panel
          ref={pdfPanelRef}
          id="pdf"
          order={2}
          defaultSize={50}
          minSize={5}
          collapsible
          onCollapse={collapsed => setPdfIsOpen(!collapsed)}
        >
          <PlaceholderPdf />
        </Panel>
      ) : null}
    </PanelGroup>
  )
}
