import { useOutlineContext } from '@/features/ide-react/context/outline-context'
import { useProjectContext } from '@/shared/context/project-context'
import { useEffect, useRef } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'
import localStorage from '@/infrastructure/local-storage'

export const useOutlinePane = () => {
  const { canShowOutline, outlineExpanded } = useOutlineContext()
  const { _id: projectId } = useProjectContext()
  const outlineDisabled = !canShowOutline || !outlineExpanded

  const outlineRef = useRef<ImperativePanelHandle>(null)

  // store the expanded height in localStorage when collapsing,
  // so it can be restored when expanding after reloading the page
  useEffect(() => {
    const outlinePane = outlineRef.current

    if (outlinePane) {
      // NOTE: outline size is shared across projects
      const storageKey = 'ide-panel.outline.size'

      if (outlineDisabled) {
        // collapsing, so store the current size if > 0
        const size = outlinePane.getSize()
        if (size > 0) {
          localStorage.setItem(storageKey, size)
        }

        outlinePane.collapse()
      } else {
        outlinePane.expand()

        // if the panel has been expanded to zero height, use the stored height instead
        if (outlinePane.getSize() === 0) {
          const size = Number(localStorage.getItem(storageKey) || 50)
          outlinePane.resize(size)
        }
      }
    }
  }, [outlineDisabled, projectId])

  return { outlineDisabled, outlineRef }
}
