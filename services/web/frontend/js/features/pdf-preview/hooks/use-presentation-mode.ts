import { useCallback, useEffect, useRef, useState } from 'react'
import PDFJSWrapper from '../util/pdf-js-wrapper'
import { debugConsole } from '@/utils/debugging'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'

type StoredPDFState = {
  scrollMode?: number
  spreadMode?: number
  currentScaleValue?: string
}

export default function usePresentationMode(
  pdfJsWrapper: PDFJSWrapper | null | undefined,
  page: number | null,
  handlePageChange: (page: number) => void,
  scale: string,
  setScale: (scale: string) => void
): () => void {
  const storedState = useRef<StoredPDFState>({})
  const { sendEvent } = useEditorAnalytics()

  const [presentationMode, setPresentationMode] = useState(false)

  const nextPage = useCallback(() => {
    if (page !== null) {
      handlePageChange(page + 1)
    }
  }, [handlePageChange, page])

  const previousPage = useCallback(() => {
    if (page !== null) {
      handlePageChange(page - 1)
    }
  }, [handlePageChange, page])

  const clickListener = useCallback(
    (event: MouseEvent) => {
      if ((event.target as HTMLElement).tagName === 'A') {
        return
      }

      if (event.shiftKey) {
        previousPage()
      } else {
        nextPage()
      }
    },
    [nextPage, previousPage]
  )

  const arrowKeyListener = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          previousPage()
          break

        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          nextPage()
          break

        case ' ':
          if (event.shiftKey) {
            previousPage()
          } else {
            nextPage()
          }
          break
      }
    },
    [nextPage, previousPage]
  )

  const isMouseWheelScrollingRef = useRef(false)

  const mouseWheelListener = useCallback(
    (event: WheelEvent) => {
      if (
        !isMouseWheelScrollingRef.current &&
        !event.ctrlKey // Avoid trackpad pinching
      ) {
        isMouseWheelScrollingRef.current = true

        if (event.deltaY > 0) {
          nextPage()
        } else {
          previousPage()
        }

        setTimeout(() => {
          isMouseWheelScrollingRef.current = false
        }, 200)
      }
    },
    [nextPage, previousPage]
  )

  useEffect(() => {
    if (presentationMode) {
      window.addEventListener('keydown', arrowKeyListener)
      window.addEventListener('click', clickListener)
      window.addEventListener('wheel', mouseWheelListener)

      return () => {
        window.removeEventListener('keydown', arrowKeyListener)
        window.removeEventListener('click', clickListener)
        window.removeEventListener('wheel', mouseWheelListener)
      }
    }
  }, [presentationMode, arrowKeyListener, clickListener, mouseWheelListener])

  const requestPresentationMode = useCallback(() => {
    sendEvent('pdf-viewer-enter-presentation-mode')

    if (pdfJsWrapper) {
      pdfJsWrapper.container.parentElement
        ?.requestFullscreen()
        .catch(debugConsole.error)
    }
  }, [pdfJsWrapper, sendEvent])

  const handleEnterFullscreen = useCallback(() => {
    if (pdfJsWrapper) {
      storedState.current.scrollMode = pdfJsWrapper.viewer.scrollMode
      storedState.current.spreadMode = pdfJsWrapper.viewer.spreadMode
      storedState.current.currentScaleValue = scale

      setScale('page-fit')
      pdfJsWrapper.viewer.scrollMode = 3 // page
      pdfJsWrapper.viewer.spreadMode = 0 // none

      pdfJsWrapper.fetchAllData()

      setPresentationMode(true)
    }
  }, [pdfJsWrapper, setScale, scale])

  const handleExitFullscreen = useCallback(() => {
    if (pdfJsWrapper) {
      pdfJsWrapper.viewer.scrollMode = storedState.current.scrollMode!
      pdfJsWrapper.viewer.spreadMode = storedState.current.spreadMode!

      if (storedState.current.currentScaleValue !== undefined) {
        setScale(storedState.current.currentScaleValue)
      }

      setPresentationMode(false)
    }
  }, [pdfJsWrapper, setScale])

  const handleFullscreenChange = useCallback(() => {
    if (pdfJsWrapper) {
      const fullscreen =
        document.fullscreenElement === pdfJsWrapper.container.parentNode

      if (fullscreen) {
        handleEnterFullscreen()
      } else {
        handleExitFullscreen()
      }
    }
  }, [pdfJsWrapper, handleEnterFullscreen, handleExitFullscreen])

  useEffect(() => {
    window.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [handleFullscreenChange])

  return requestPresentationMode
}
