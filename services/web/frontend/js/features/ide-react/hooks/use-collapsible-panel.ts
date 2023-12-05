import { RefObject, useEffect } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export default function useCollapsiblePanel(
  panelIsOpen: boolean,
  panelRef: RefObject<ImperativePanelHandle>
) {
  useEffect(() => {
    if (panelRef.current) {
      if (panelIsOpen) {
        panelRef.current.expand()
      } else {
        panelRef.current.collapse()
      }
    }
  }, [panelIsOpen, panelRef])
}
