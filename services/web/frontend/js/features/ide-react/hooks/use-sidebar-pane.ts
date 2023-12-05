import { useCallback, useState } from 'react'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'

export const useSidebarPane = () => {
  const [isOpen, setIsOpen] = useState(true)
  const [resizing, setResizing] = useState(false)
  const { fixedPanelRef, handleLayout } = useFixedSizeColumn(isOpen)
  useCollapsiblePanel(isOpen, fixedPanelRef)

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
    fixedPanelRef,
    handleLayout,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
    resizing,
    setResizing,
  }
}
