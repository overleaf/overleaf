import { useCallback, useRef, useState } from 'react'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useSidebarPane = () => {
  const [isOpen, setIsOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)
  useCollapsiblePanel(isOpen, panelRef)

  const togglePane = useCallback(() => {
    setIsOpen(value => !value)
  }, [])

  const handlePaneExpand = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handlePaneCollapse = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    setIsOpen,
    panelRef,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
    resizing,
    setResizing,
  }
}
