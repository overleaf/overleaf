import { useLayoutContext } from '@/shared/context/layout-context'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import useDebounce from '@/shared/hooks/use-debounce'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useChatPane = () => {
  const { chatIsOpen: isOpen, setChatIsOpen: setIsOpen } = useLayoutContext()
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)

  // Keep track of a debounced local state variable for panel openness and
  // only update the external openness state when the debounced value changes.
  // This prevents successive calls to onCollapse and onExpand from
  // react-resizable-panels updating the openness state multiple times in quick
  // succession, which causes confusing behaviour that is different in React 17
  // and 18. Collapsing the chat pane on initialization is necessary because
  // react-resizable-panels does not provide a way to specify both that a panel
  // should be collapsed and a default size for the panel when expanded.
  const [localIsOpen, setLocalIsOpen] = useState(isOpen)
  const debouncedLocalIsOpen = useDebounce(localIsOpen, 100)

  useCollapsiblePanel(isOpen, panelRef)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [setIsOpen])

  const handlePaneExpand = useCallback(() => {
    setLocalIsOpen(true)
  }, [])

  const handlePaneCollapse = useCallback(() => {
    setLocalIsOpen(false)
  }, [])

  useEffect(() => {
    setIsOpen(debouncedLocalIsOpen)
  }, [debouncedLocalIsOpen, setIsOpen])

  return {
    isOpen,
    panelRef,
    resizing,
    setResizing,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
  }
}
