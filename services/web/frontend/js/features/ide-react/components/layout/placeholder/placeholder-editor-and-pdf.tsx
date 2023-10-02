import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
} from 'react-resizable-panels'
import { HorizontalResizeHandle } from '@/features/ide-react/components/resize/horizontal-resize-handle'
import { HorizontalToggler } from '@/features/ide-react/components/resize/horizontal-toggler'
import { VerticalResizeHandle } from '@/features/ide-react/components/resize/vertical-resize-handle'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'

type PlaceholderEditorAndPdfProps = {
  shouldPersistLayout?: boolean
}

export default function PlaceholderEditorAndPdf({
  shouldPersistLayout = false,
}: PlaceholderEditorAndPdfProps) {
  const { t } = useTranslation()
  const [pdfIsOpen, setPdfIsOpen] = useState(false)
  const [symbolPaletteIsOpen, setSymbolPaletteIsOpen] = useState(false)

  const pdfPanelRef = useRef<ImperativePanelHandle>(null)
  useCollapsiblePanel(pdfIsOpen, pdfPanelRef)

  return (
    <PanelGroup
      autoSaveId={
        shouldPersistLayout ? 'ide-react-editor-and-pdf-layout' : undefined
      }
      direction="horizontal"
    >
      <Panel defaultSize={50}>
        <PanelGroup
          autoSaveId={
            shouldPersistLayout
              ? 'ide-react-editor-and-symbol-palette-layout'
              : undefined
          }
          direction="vertical"
          units="pixels"
        >
          <Panel id="editor" order={1}>
            Editor placeholder
            <br />
            <button onClick={() => setSymbolPaletteIsOpen(value => !value)}>
              Toggle symbol palette
            </button>
          </Panel>
          {symbolPaletteIsOpen ? (
            <>
              <VerticalResizeHandle id="editor-symbol-palette" />
              <Panel
                id="symbol-palette"
                order={2}
                defaultSize={250}
                minSize={250}
                maxSize={336}
              >
                <div className="ide-react-placeholder-symbol-palette ">
                  Symbol palette placeholder
                </div>
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </Panel>
      <HorizontalResizeHandle>
        <HorizontalToggler
          id="editor-pdf"
          togglerType="east"
          isOpen={pdfIsOpen}
          setIsOpen={pdfIsOpen => setPdfIsOpen(pdfIsOpen)}
          tooltipWhenOpen={t('tooltip_hide_pdf')}
          tooltipWhenClosed={t('tooltip_show_pdf')}
        />
      </HorizontalResizeHandle>
      <Panel
        ref={pdfPanelRef}
        defaultSize={50}
        minSize={5}
        collapsible
        onCollapse={collapsed => setPdfIsOpen(!collapsed)}
      >
        PDF placeholder
      </Panel>
    </PanelGroup>
  )
}
