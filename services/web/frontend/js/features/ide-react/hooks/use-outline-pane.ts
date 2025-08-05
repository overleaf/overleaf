import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import useCollapsiblePanel from '@/features/ide-react/hooks/use-collapsible-panel'
import { useRef } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'

export const useOutlinePane = () => {
  const { canShowOutline, outlineExpanded, expandOutline, collapseOutline } =
    useOutlineContext()
  const outlinePanelRef = useRef<ImperativePanelHandle>(null)
  const outlineEnabled = canShowOutline && outlineExpanded

  useCollapsiblePanel(outlineEnabled, outlinePanelRef)

  return {
    outlineEnabled,
    canShowOutline,
    outlinePanelRef,
    expandOutline,
    collapseOutline,
  }
}
