import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { useLayoutContext } from '../../../../../shared/context/layout-context'
import useScopeValue from '../../../../../shared/hooks/use-scope-value'

export type Coordinates = {
  x: number
  y: number
}

function useIndicatorHover() {
  const [hoverCoords, setHoverCoords] = useState<Coordinates | null>(null)
  const [layoutToLeft] = useScopeValue<boolean>('reviewPanel.layoutToLeft')
  const { toggleReviewPanel } = useReviewPanelUpdaterFnsContext()
  const { reviewPanelOpen } = useLayoutContext()
  const { setLayoutSuspended, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()
  const indicatorRef = useRef<HTMLDivElement | null>(null)

  const handleEntryMouseLeave = () => {
    if (!reviewPanelOpen && !layoutToLeft) {
      // Use flushSync to ensure that React renders immediately. This is
      // necessary to ensure that the subsequent layout update acts on the
      // updated DOM.
      flushSync(() => {
        setHoverCoords(null)
        setLayoutSuspended(false)
      })
      handleLayoutChange(true)
    }
  }

  const handleIndicatorMouseEnter = () => {
    if (!layoutToLeft) {
      const rect = indicatorRef.current?.getBoundingClientRect()
      setHoverCoords({
        x: rect?.left || 0,
        y: rect?.top || 0,
      })
      setLayoutSuspended(true)
    }
  }

  const handleIndicatorClick = () => {
    setHoverCoords(null)
    setLayoutSuspended(false)
    toggleReviewPanel()
  }

  return {
    hoverCoords,
    indicatorRef,
    handleEntryMouseLeave,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  }
}

export default useIndicatorHover
