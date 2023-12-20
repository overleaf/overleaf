import { RefObject, useEffect } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export default function useCollapsiblePanel(
  panelIsOpen: boolean,
  panelRef: RefObject<ImperativePanelHandle>
) {
  // collapse the panel when it is toggled closed (including on initial layout)
  useEffect(() => {
    const panelHandle = panelRef.current

    if (panelHandle) {
      if (panelIsOpen) {
        panelHandle.expand()
      } else {
        panelHandle.collapse()
      }
    }
  }, [panelIsOpen, panelRef])
}
