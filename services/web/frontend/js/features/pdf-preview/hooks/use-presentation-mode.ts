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

  const arrowKeyListener = useCallback(
    event => {
      if (page !== null) {
        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            handlePageChange(page - 1)
            break

          case 'ArrowRight':
          case 'ArrowDown':
            handlePageChange(page + 1)
            break

          case ' ':
            if (event.shiftKey) {
              handlePageChange(page - 1)
            } else {
              handlePageChange(page + 1)
            }
            break
        }
      }
    },
    [page, handlePageChange]
  )

  useEffect(() => {
    if (presentationMode) {
      window.addEventListener('keydown', arrowKeyListener)

      return () => {
        window.removeEventListener('keydown', arrowKeyListener)
      }
    }
  }, [presentationMode, arrowKeyListener])

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
