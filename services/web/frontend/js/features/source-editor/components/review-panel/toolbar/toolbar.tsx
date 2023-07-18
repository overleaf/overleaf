import ResolvedCommentsDropdown from './resolved-comments-dropdown'
import ToggleMenu from './toggle-menu'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { useCallback } from 'react'
import { useResizeObserver } from '../../../../../shared/hooks/use-resize-observer'

function Toolbar() {
  const { setToolbarHeight } = useReviewPanelUpdaterFnsContext()
  const handleResize = useCallback(
    el => {
      // Use requestAnimationFrame to prevent errors like "ResizeObserver loop
      // completed with undelivered notifications" that occur if onResize does
      // something complicated. The cost of this is that onResize lags one frame
      // behind, but it's unlikely to matter.
      const height = el.offsetHeight
      window.requestAnimationFrame(() => setToolbarHeight(height))
    },
    [setToolbarHeight]
  )
  const { elementRef } = useResizeObserver(handleResize)

  return (
    <div ref={elementRef} className="review-panel-toolbar">
      <ResolvedCommentsDropdown />
      <ToggleMenu />
    </div>
  )
}

export default Toolbar
