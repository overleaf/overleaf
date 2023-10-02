import { RefObject, useEffect } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export default function useCollapsiblePanel(
  panelIsOpen: boolean,
  panelRef: RefObject<ImperativePanelHandle>
) {
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) {
      return
    }
    if (panelIsOpen) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [panelIsOpen, panelRef])
}
