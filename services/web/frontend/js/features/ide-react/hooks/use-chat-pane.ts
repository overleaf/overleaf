import { useLayoutContext } from '@/shared/context/layout-context'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useCallback, useRef, useState } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useChatPane = () => {
  const { chatIsOpen: isOpen, setChatIsOpen: setIsOpen } = useLayoutContext()
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)

  useCollapsiblePanel(isOpen, panelRef)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [setIsOpen])

  const handlePaneExpand = useCallback(() => {
    setIsOpen(true)
  }, [setIsOpen])

  const handlePaneCollapse = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

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
