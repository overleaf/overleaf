import { useLayoutContext } from '@/shared/context/layout-context'
import useFixedSizeColumn from '@/features/ide-react/hooks/use-fixed-size-column'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useState } from 'react'

export const useChatPane = () => {
  const { chatIsOpen: isOpen } = useLayoutContext()
  const [resizing, setResizing] = useState(false)
  const { fixedPanelRef, handleLayout } = useFixedSizeColumn(isOpen)
  useCollapsiblePanel(isOpen, fixedPanelRef)

  return { isOpen, fixedPanelRef, handleLayout, resizing, setResizing }
}
