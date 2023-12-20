import { RefObject, useEffect } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export default function useCollapsiblePanel(
  panelIsOpen: boolean,
  panelRef: RefObject<ImperativePanelHandle>
) {
  // store the expanded height in localStorage when collapsing,
  // so it can be restored when expanding after reloading the page
  useEffect(() => {
    const panelHandle = panelRef.current

    if (panelHandle) {
      const storageKey = `ide-panel.expanded-size.${panelHandle.getId()}`
      if (!panelIsOpen) {
        // collapsing, so store the current size if > 0
        const size = panelHandle.getSize()
        if (size > 0) {
          localStorage.setItem(storageKey, String(size))
        }

        panelHandle.collapse()
      } else {
        const storedKey = localStorage.getItem(storageKey)

        if (storedKey) {
          panelHandle.resize(Number(storedKey))
        } else {
          panelHandle.expand()
        }
      }
    }
  }, [panelIsOpen, panelRef])
}
