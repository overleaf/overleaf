import { useCallback, useEffect, useRef, useState } from 'react'
import { ImperativePanelHandle } from 'react-resizable-panels'
import { PanelGroupOnLayout } from 'react-resizable-panels/src/types'

export default function useFixedSizeColumn(
  defaultSize: number,
  isOpen: boolean
) {
  const fixedPanelRef = useRef<ImperativePanelHandle>(null)

  const fixedPanelWidthRef = useRef({ size: defaultSize, pixels: 0 })
  const [initialLayoutDone, setInitialLayoutDone] = useState(false)

  const measureFixedPanelSizePixels = useCallback(() => {
    return fixedPanelRef.current?.getSize('pixels') || 0
  }, [fixedPanelRef])

  const handleLayout: PanelGroupOnLayout = useCallback(
    sizes => {
      // Measure the pixel width here because it's not always up to date in the
      // panel's onResize
      fixedPanelWidthRef.current = {
        size: sizes[0],
        pixels: measureFixedPanelSizePixels(),
      }
      setInitialLayoutDone(true)
    },
    [measureFixedPanelSizePixels]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // Only start watching for resizes once the initial layout is done,
    // otherwise we could measure the fixed column while it has zero width and
    // collapse it
    if (!initialLayoutDone || !fixedPanelRef.current) {
      return
    }

    const fixedPanelElement = document.querySelector(
      `[data-panel-id="${fixedPanelRef.current.getId()}"]`
    )

    const panelGroupElement = fixedPanelElement?.closest('[data-panel-group]')
    if (!panelGroupElement || !fixedPanelElement) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      fixedPanelRef.current?.resize(fixedPanelWidthRef.current.pixels, 'pixels')
    })

    resizeObserver.observe(panelGroupElement)

    return () => resizeObserver.unobserve(panelGroupElement)
  }, [fixedPanelRef, measureFixedPanelSizePixels, initialLayoutDone, isOpen])

  return {
    fixedPanelRef,
    fixedPanelWidthRef,
    handleLayout,
  }
}
