import { useCallback, useEffect, useRef, useState } from 'react'
import PDFJSWrapper from '../util/pdf-js-wrapper'

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
    event => {
      if (event.target.tagName === 'A') {
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
    event => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          previousPage()
          break

        case 'ArrowRight':
        case 'ArrowDown':
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

  useEffect(() => {
    if (presentationMode) {
      window.addEventListener('keydown', arrowKeyListener)
      window.addEventListener('click', clickListener)

      return () => {
        window.removeEventListener('keydown', arrowKeyListener)
        window.removeEventListener('click', clickListener)
      }
    }
  }, [presentationMode, arrowKeyListener, clickListener])

  const requestPresentationMode = useCallback(() => {
    if (pdfJsWrapper) {
      pdfJsWrapper.container.parentNode.requestFullscreen()
    }
  }, [pdfJsWrapper])

  const handleEnterFullscreen = useCallback(() => {
    if (pdfJsWrapper) {
      storedState.current.scrollMode = pdfJsWrapper.viewer.scrollMode
      storedState.current.spreadMode = pdfJsWrapper.viewer.spreadMode
      storedState.current.currentScaleValue = scale

      setScale('page-fit')
      pdfJsWrapper.viewer.scrollMode = 3 // page
      pdfJsWrapper.viewer.spreadMode = 0 // none

      setPresentationMode(true)
    }
  }, [pdfJsWrapper, setScale, scale])

  const handleExitFullscreen = useCallback(() => {
    if (pdfJsWrapper) {
      pdfJsWrapper.viewer.scrollMode = storedState.current.scrollMode
      pdfJsWrapper.viewer.spreadMode = storedState.current.spreadMode

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
