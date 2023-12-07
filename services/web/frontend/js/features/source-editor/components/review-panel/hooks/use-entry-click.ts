import { useReviewPanelUpdaterFnsContext } from '@/features/source-editor/context/review-panel/review-panel-context'
import { DocId } from '../../../../../../../types/project-settings'

export function useEntryClick(
  docId: DocId,
  offset: number,
  cb?: (e: React.MouseEvent<HTMLDivElement>) => void
) {
  const { gotoEntry } = useReviewPanelUpdaterFnsContext()

  return (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element

    // Ignore clicks inside interactive elements
    if (!target.closest('textarea, button, a')) {
      // If the user was making a selection within the entry rather than
      // clicking it, ignore the click. Do this by checking whether there is a
      // selection that intersects with the target, in which case we assume
      // the user was making a selection
      const selection = window.getSelection()
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !selection.getRangeAt(0).intersectsNode(target)
      ) {
        gotoEntry(docId, offset)
      }
    }

    cb?.(e)
  }
}
