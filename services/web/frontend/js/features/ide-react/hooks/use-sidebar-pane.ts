import { useCallback, useRef, useState } from 'react'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useSidebarPane = () => {
  const [isOpen, setIsOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const panelRef = useRef<ImperativePanelHandle>(null)
  const handleLayout = useFixedSizeColumn(isOpen, panelRef)
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
    handleLayout,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
    resizing,
    setResizing,
  }
}
