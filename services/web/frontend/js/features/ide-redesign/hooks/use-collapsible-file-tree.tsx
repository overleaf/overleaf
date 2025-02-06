import { ImperativePanelHandle } from 'react-resizable-panels'
import { useRef } from 'react'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useFileTreeOpenContext } from '@/features/ide-react/context/file-tree-open-context'

export default function useCollapsibleFileTree() {
  const { fileTreeExpanded, toggleFileTreeExpanded } = useFileTreeOpenContext()
  const fileTreePanelRef = useRef<ImperativePanelHandle>(null)
  useCollapsiblePanel(fileTreeExpanded, fileTreePanelRef)

  return { fileTreeExpanded, fileTreePanelRef, toggleFileTreeExpanded }
}
