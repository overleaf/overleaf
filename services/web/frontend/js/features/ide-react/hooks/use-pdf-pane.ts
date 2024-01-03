import { useCallback, useRef } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useLayoutContext } from '@/shared/context/layout-context'

export const usePdfPane = () => {
  const { view, pdfLayout, changeLayout, detachRole, reattach } =
    useLayoutContext()

  const pdfPanelRef = useRef<ImperativePanelHandle>(null)
  const pdfIsOpen = pdfLayout === 'sideBySide' || view === 'pdf'

  useCollapsiblePanel(pdfIsOpen, pdfPanelRef)

  // triggered by a double-click on the resizer
  const togglePdfPane = useCallback(() => {
    if (pdfIsOpen) {
      changeLayout('flat', 'editor')
    } else {
      changeLayout('sideBySide')
    }
  }, [changeLayout, pdfIsOpen])

  // triggered by a click on the toggle button
  const setPdfIsOpen = useCallback(
    (value: boolean) => {
      if (value) {
        // opening the PDF view, so close a detached PDF
        if (detachRole === 'detacher') {
          reattach()
        }
        changeLayout('sideBySide')
      } else {
        changeLayout('flat', 'editor')
      }
    },
    [changeLayout, detachRole, reattach]
  )

  // triggered when the PDF pane becomes open
  const handlePdfPaneExpand = useCallback(() => {
    if (pdfLayout === 'flat' && view === 'editor') {
      changeLayout('sideBySide', 'editor')
    }
  }, [changeLayout, pdfLayout, view])

  // triggered when the PDF pane becomes closed (either by dragging or toggling)
  const handlePdfPaneCollapse = useCallback(() => {
    if (pdfLayout === 'sideBySide') {
      changeLayout('flat', 'editor')
    }
  }, [changeLayout, pdfLayout])

  return {
    togglePdfPane,
    handlePdfPaneExpand,
    handlePdfPaneCollapse,
    setPdfIsOpen,
    pdfIsOpen,
    pdfPanelRef,
  }
}
