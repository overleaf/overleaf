import { useCallback, useEffect, useRef } from 'react'
import PDFJSWrapper from '../util/pdf-js-wrapper'

// We need this to work for both a traditional mouse wheel and a touchpad "pinch to zoom".
// From experimentation, trackpads tend to fire a lot of events with small deltaY's where
// as a mouse wheel will fire fewer events but sometimes with a very high deltaY if you
// move the wheel quickly.
// The divisor is set to a value that works for the trackpad with the maximum value ensuring
// that the scale doesn't suddenly change drastically from moving the mouse wheel quickly.
const MAX_SCALE_FACTOR = 1.2
const SCALE_FACTOR_DIVISOR = 20

export default function useMouseWheelZoom(
  pdfJsWrapper: PDFJSWrapper | null | undefined,
  setScale: (scale: string) => void
) {
  const isZoomingRef = useRef(false)

  // To avoid accidental pdf when pressing CMD/CTRL when the pdf scroll still has
  // momentum, we only zoom if CMD/CTRL is pressed before the scroll starts. These refs
  // keep track of if the pdf is currently scrolling.
  // https://github.com/overleaf/internal/issues/20772
  const isScrollingRef = useRef(false)
  const isScrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const performZoom = useCallback(
    (event: WheelEvent, pdfJsWrapper: PDFJSWrapper) => {
      // First, we calculate and set the new scale
      const scrollMagnitude = Math.abs(event.deltaY)
      const scaleFactorMagnitude = Math.min(
        1 + scrollMagnitude / SCALE_FACTOR_DIVISOR,
        MAX_SCALE_FACTOR
      )
      const previousScale = pdfJsWrapper.viewer.currentScale
      const scaleChangeDirection = Math.sign(event.deltaY)

      const approximateScaleFactor =
        scaleChangeDirection < 0
          ? scaleFactorMagnitude
          : 1 / scaleFactorMagnitude

      const newScale =
        Math.round(previousScale * approximateScaleFactor * 100) / 100
      const exactScaleFactor = newScale / previousScale

      // Set the scale directly to ensure it is set before we do the scrolling below
      pdfJsWrapper.viewer.currentScale = newScale
      setScale(`${newScale}`)

      // Then we need to ensure we are centering the zoom on the mouse position
      const containerRect = pdfJsWrapper.container.getBoundingClientRect()
      const top = containerRect.top
      const left = containerRect.left

      // Positions relative to pdf viewer
      const currentMouseX = event.clientX - left
      const currentMouseY = event.clientY - top

      pdfJsWrapper.container.scrollBy({
        left: currentMouseX * exactScaleFactor - currentMouseX,
        top: currentMouseY * exactScaleFactor - currentMouseY,
        behavior: 'instant',
      })
    },
    [setScale]
  )

  useEffect(() => {
    if (pdfJsWrapper) {
      const wheelListener = (event: WheelEvent) => {
        if ((event.metaKey || event.ctrlKey) && !isScrollingRef.current) {
          event.preventDefault()

          if (!isZoomingRef.current) {
            isZoomingRef.current = true

            performZoom(event, pdfJsWrapper)

            setTimeout(() => {
              isZoomingRef.current = false
            }, 5)
          }
        } else {
          isScrollingRef.current = true
          if (isScrollingTimeoutRef.current) {
            clearTimeout(isScrollingTimeoutRef.current)
          }

          isScrollingTimeoutRef.current = setTimeout(() => {
            isScrollingRef.current = false
          }, 100)
        }
      }

      pdfJsWrapper.container.addEventListener('wheel', wheelListener)

      return () => {
        pdfJsWrapper.container.removeEventListener('wheel', wheelListener)
      }
    }
  }, [pdfJsWrapper, setScale, performZoom])
}
