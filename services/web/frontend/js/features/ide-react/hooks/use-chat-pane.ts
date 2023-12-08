import { useLayoutContext } from '@/shared/context/layout-context'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useCallback, useState } from 'react'

export const useChatPane = () => {
  const { chatIsOpen: isOpen, setChatIsOpen: setIsOpen } = useLayoutContext()
  const [resizing, setResizing] = useState(false)
  const { fixedPanelRef, handleLayout } = useFixedSizeColumn(isOpen)
  useCollapsiblePanel(isOpen, fixedPanelRef)

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
    fixedPanelRef,
    handleLayout,
    resizing,
    setResizing,
    togglePane,
    handlePaneExpand,
    handlePaneCollapse,
  }
}
