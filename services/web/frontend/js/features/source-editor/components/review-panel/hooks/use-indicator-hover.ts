import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { useLayoutContext } from '../../../../../shared/context/layout-context'
import EntryIndicator from '../entries/entry-indicator'

export type Coordinates = {
  x: number
  y: number
}

function useIndicatorHover() {
  const [hoverCoords, setHoverCoords] = useState<Coordinates | null>(null)
  const { toggleReviewPanel } = useReviewPanelUpdaterFnsContext()
  const { reviewPanelOpen } = useLayoutContext()
  const { setLayoutSuspended, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()
  const indicatorRef = useRef<React.ElementRef<typeof EntryIndicator> | null>(
    null
  )

  const endHover = useCallback(() => {
    if (!reviewPanelOpen) {
      // Use flushSync to ensure that React renders immediately. This is
      // necessary to ensure that the subsequent layout update acts on the
      // updated DOM.
      flushSync(() => {
        setHoverCoords(null)
        setLayoutSuspended(false)
      })
      handleLayoutChange({ force: true })
    }
  }, [handleLayoutChange, reviewPanelOpen, setLayoutSuspended])

  const handleIndicatorMouseEnter = () => {
    const rect = indicatorRef.current?.getBoundingClientRect()
    setHoverCoords({
      x: rect?.left || 0,
      y: rect?.top || 0,
    })
    setLayoutSuspended(true)
  }

  const handleIndicatorClick = () => {
    setHoverCoords(null)
    setLayoutSuspended(false)
    toggleReviewPanel()
  }

  useEffect(() => {
    if (hoverCoords) {
      window.addEventListener('editor:scroll', endHover)

      return () => {
        window.removeEventListener('editor:scroll', endHover)
      }
    }
  }, [hoverCoords, endHover])

  return {
    hoverCoords,
    indicatorRef,
    endHover,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  }
}

export default useIndicatorHover
