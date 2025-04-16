import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { debounce, throttle } from 'lodash'
import PdfViewerControlsToolbar from './pdf-viewer-controls-toolbar'
import { useProjectContext } from '../../../shared/context/project-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { buildHighlightElement } from '../util/highlights'
import PDFJSWrapper from '../util/pdf-js-wrapper'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewErrorBoundaryFallback from './pdf-preview-error-boundary-fallback'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { captureException } from '../../../infrastructure/error-reporter'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { getPdfCachingMetrics } from '../util/metrics'
import { debugConsole } from '@/utils/debugging'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import usePresentationMode from '../hooks/use-presentation-mode'
import useMouseWheelZoom from '../hooks/use-mouse-wheel-zoom'
import { PDFJS } from '../util/pdf-js'

type PdfJsViewerProps = {
  url: string
  pdfFile: Record<string, any>
}

function PdfJsViewer({ url, pdfFile }: PdfJsViewerProps) {
  const { _id: projectId } = useProjectContext()

  const { setError, firstRenderDone, highlights, position, setPosition } =
    useCompileContext()

  const { setLoadingError } = usePdfPreviewContext()

  // state values persisted in localStorage to restore on load
  const [scale, setScale] = usePersistedState(
    `pdf-viewer-scale:${projectId}`,
    'page-width'
  )

  // rawScale is different from scale as it is always a number.
  // This is relevant when scale is e.g. 'page-width'.
  const [rawScale, setRawScale] = useState<number | null>(null)
  const [page, setPage] = useState<number | null>(null)
  const [totalPages, setTotalPages] = useState<number | null>(null)

  // local state values
  const [pdfJsWrapper, setPdfJsWrapper] = useState<PDFJSWrapper | null>()
  const [initialised, setInitialised] = useState(false)

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (!totalPages || newPage < 1 || newPage > totalPages) {
        return
      }

      setPage(newPage)
      if (pdfJsWrapper?.viewer) {
        pdfJsWrapper.viewer.currentPageNumber = newPage
      }
    },
    [pdfJsWrapper, setPage, totalPages]
  )

  // create the viewer when the container is mounted
  const handleContainer = useCallback(
    parent => {
      if (parent) {
        try {
          setPdfJsWrapper(new PDFJSWrapper(parent.firstChild))
        } catch (error: any) {
          setLoadingError(true)
          captureException(error)
        }
      }
    },
    [setLoadingError]
  )

  useEffect(() => {
    return () => {
      setPdfJsWrapper(null)
    }
  }, [])

  const [startFetch, setStartFetch] = useState(0)

  // listen for events and trigger rendering.
  // Do everything in one effect to mitigate de-sync between events.
  useEffect(() => {
    if (!pdfJsWrapper || !firstRenderDone) return

    let timePDFFetched: number
    let timePDFRendered: number
    const submitLatencies = () => {
      if (!timePDFFetched) {
        // The pagerendered event was attached after pagesinit fired. :/
        return
      }

      const latencyFetch = Math.ceil(timePDFFetched - startFetch)
      let latencyRender
      if (timePDFRendered) {
        // The renderer does not yield in case the browser tab is hidden.
        // It will yield when the browser tab is visible again.
        // This will skew our performance metrics for rendering!
        // We are omitting the render time in case we detect this state.
        latencyRender = Math.ceil(timePDFRendered - timePDFFetched)
      }
      firstRenderDone({
        latencyFetch,
        latencyRender,
        // Let the pdfCachingMetrics round trip to account for pdf-detach.
        pdfCachingMetrics: getPdfCachingMetrics(),
      })
    }

    const handlePagesinit = () => {
      setInitialised(true)
      timePDFFetched = performance.now()
      if (document.hidden) {
        // Rendering does not start in case we are hidden. See comment above.
        submitLatencies()
      }
    }

    const handleRendered = () => {
      if (!document.hidden) {
        // The render time is not accurate in case we are hidden. See above.
        timePDFRendered = performance.now()
      }
      submitLatencies()

      // Only get the times for the first page.
      pdfJsWrapper.eventBus.off('pagerendered', handleRendered)
    }

    const handleRenderedInitialPageNumber = () => {
      setPage(pdfJsWrapper.viewer.currentPageNumber)

      // Only need to set the initial page number once.
      pdfJsWrapper.eventBus.off('pagerendered', handleRenderedInitialPageNumber)
    }

    const handleScaleChanged = (scale: { scale: number }) => {
      setRawScale(scale.scale)
    }

    // `pagesinit` fires when the data for rendering the first page is ready.
    pdfJsWrapper.eventBus.on('pagesinit', handlePagesinit)
    // `pagerendered` fires when a page was actually rendered.
    pdfJsWrapper.eventBus.on('pagerendered', handleRendered)
    // Once a page has been rendered we can set the initial current page number.
    pdfJsWrapper.eventBus.on('pagerendered', handleRenderedInitialPageNumber)
    pdfJsWrapper.eventBus.on('scalechanging', handleScaleChanged)

    return () => {
      pdfJsWrapper.eventBus.off('pagesinit', handlePagesinit)
      pdfJsWrapper.eventBus.off('pagerendered', handleRendered)
      pdfJsWrapper.eventBus.off('pagerendered', handleRenderedInitialPageNumber)
      pdfJsWrapper.eventBus.off('scalechanging', handleScaleChanged)
    }
  }, [pdfJsWrapper, firstRenderDone, startFetch])

  // load the PDF document from the URL
  useEffect(() => {
    if (pdfJsWrapper && url) {
      setInitialised(false)
      setError(undefined)
      setStartFetch(performance.now())

      const abortController = new AbortController()
      const handleFetchError = (err: Error) => {
        if (abortController.signal.aborted) return
        // The error is already logged at the call-site with additional context.
        if (err instanceof PDFJS.MissingPDFException) {
          setError('rendering-error-expected')
        } else {
          setError('rendering-error')
        }
      }
      pdfJsWrapper
        .loadDocument({ url, pdfFile, abortController, handleFetchError })
        .then(doc => {
          if (doc) {
            setTotalPages(doc.numPages)
          }
        })
        .catch(error => {
          if (abortController.signal.aborted) return
          debugConsole.error(error)
          setError('rendering-error')
        })
      return () => {
        abortController.abort()
      }
    }
  }, [pdfJsWrapper, url, pdfFile, setError, setStartFetch])

  // listen for scroll events
  useEffect(() => {
    let storePositionTimer: number

    if (initialised && pdfJsWrapper) {
      if (!pdfJsWrapper.isVisible()) {
        return
      }

      // store the scroll position in localStorage, for the synctex button
      const storePosition = debounce(pdfViewer => {
        // set position for "sync to code" button
        try {
          setPosition(pdfViewer.currentPosition)
        } catch (error) {
          // debugConsole.error(error)
        }
      }, 500)

      storePositionTimer = window.setTimeout(() => {
        storePosition(pdfJsWrapper)
      }, 100)

      const scrollListener = () => {
        storePosition(pdfJsWrapper)
        setPage(pdfJsWrapper.viewer.currentPageNumber)
      }

      pdfJsWrapper.container.addEventListener('scroll', scrollListener)

      return () => {
        pdfJsWrapper.container.removeEventListener('scroll', scrollListener)
        if (storePositionTimer) {
          window.clearTimeout(storePositionTimer)
        }
        storePosition.cancel()
      }
    }
  }, [setPosition, pdfJsWrapper, initialised])

  // listen for double-click events
  useEffect(() => {
    if (pdfJsWrapper) {
      const handleTextlayerrendered = (textLayer: any) => {
        // handle both versions for backwards-compatibility
        const textLayerDiv =
          textLayer.source.textLayerDiv ?? textLayer.source.textLayer.div

        if (!textLayerDiv.dataset.listeningForDoubleClick) {
          textLayerDiv.dataset.listeningForDoubleClick = true

          const doubleClickListener = (event: MouseEvent) => {
            const clickPosition = pdfJsWrapper.clickPosition(
              event,
              textLayerDiv.closest('.page').querySelector('canvas'),
              textLayer.pageNumber - 1
            )

            if (clickPosition) {
              eventTracking.sendMB('jump-to-location', {
                direction: 'pdf-location-in-code',
                method: 'double-click',
              })

              window.dispatchEvent(
                new CustomEvent('synctex:sync-to-position', {
                  detail: clickPosition,
                })
              )
            }
          }

          textLayerDiv.addEventListener('dblclick', doubleClickListener)
        }
      }

      pdfJsWrapper.eventBus.on('textlayerrendered', handleTextlayerrendered)
      return () =>
        pdfJsWrapper.eventBus.off('textlayerrendered', handleTextlayerrendered)
    }
  }, [pdfJsWrapper])

  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const scaleRef = useRef(scale)
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  // restore the saved scale and scroll position
  useEffect(() => {
    if (initialised && pdfJsWrapper) {
      if (!pdfJsWrapper.isVisible()) {
        return
      }
      if (positionRef.current) {
        // Typescript is incorrectly inferring the type of the scale argument to
        // scrollToPosition from its default value. We can remove this ignore once
        // pdfJsWrapper is converted to using tyepscript.
        // @ts-ignore
        pdfJsWrapper.scrollToPosition(positionRef.current, scaleRef.current)
      } else {
        pdfJsWrapper.viewer.currentScaleValue = scaleRef.current
      }
    }
  }, [initialised, pdfJsWrapper, scaleRef, positionRef])

  // transmit scale value to the viewer when it changes
  useEffect(() => {
    if (pdfJsWrapper) {
      pdfJsWrapper.viewer.currentScaleValue = scale
    }
  }, [scale, pdfJsWrapper])

  // when highlights are created, build the highlight elements
  useEffect(() => {
    const timers: number[] = []
    let intersectionObserver: IntersectionObserver

    if (pdfJsWrapper && highlights?.length) {
      // watch for the highlight elements to scroll into view
      intersectionObserver = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              intersectionObserver.unobserve(entry.target)

              const element = entry.target as HTMLElement

              // fade the element in and out
              element.style.opacity = '0.5'

              timers.push(
                window.setTimeout(() => {
                  element.style.opacity = '0'
                }, 1100)
              )
            }
          }
        },
        {
          threshold: 1.0, // the whole element must be visible
        }
      )

      const elements: HTMLDivElement[] = []

      for (const highlight of highlights) {
        try {
          const element = buildHighlightElement(highlight, pdfJsWrapper.viewer)
          elements.push(element)
          intersectionObserver.observe(element)
        } catch (error) {
          // ignore invalid highlights
        }
      }

      const [firstElement] = elements

      if (firstElement) {
        // scroll to the first highlighted element
        // Briefly delay the scrolling after adding the element to the DOM.
        timers.push(
          window.setTimeout(() => {
            firstElement.scrollIntoView({
              block: 'center',
              inline: 'start',
              behavior: 'smooth',
            })
          }, 100)
        )
      }

      return () => {
        for (const timer of timers) {
          window.clearTimeout(timer)
        }
        for (const element of elements) {
          element.remove()
        }
        intersectionObserver?.disconnect()
      }
    }
  }, [highlights, pdfJsWrapper])

  // set the scale in response to zoom option changes
  const setZoom = useCallback(
    zoom => {
      switch (zoom) {
        case 'zoom-in':
          if (pdfJsWrapper) {
            setScale(
              `${Math.min(pdfJsWrapper.viewer.currentScale * 1.25, 9.99)}`
            )
          }
          break

        case 'zoom-out':
          if (pdfJsWrapper) {
            setScale(
              `${Math.max(pdfJsWrapper.viewer.currentScale / 1.25, 0.1)}`
            )
          }
          break

        default:
          setScale(zoom)
      }
    },
    [pdfJsWrapper, setScale]
  )

  // adjust the scale when the container is resized
  useEffect(() => {
    if (pdfJsWrapper && 'ResizeObserver' in window) {
      const resizeListener = throttle(() => {
        pdfJsWrapper.updateOnResize()
      }, 250)

      const resizeObserver = new ResizeObserver(resizeListener)
      resizeObserver.observe(pdfJsWrapper.container)

      window.addEventListener('resize', resizeListener)

      return () => {
        resizeObserver.disconnect()
        window.removeEventListener('resize', resizeListener)
      }
    }
  }, [pdfJsWrapper])

  const handleKeyDown = useCallback(
    event => {
      if (!initialised || !pdfJsWrapper) {
        return
      }
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case '+':
          case '=':
            event.preventDefault()
            setZoom('zoom-in')
            pdfJsWrapper.container.focus()
            break

          case '-':
            event.preventDefault()
            setZoom('zoom-out')
            pdfJsWrapper.container.focus()
            break

          case '0':
            event.preventDefault()
            setZoom('page-width')
            pdfJsWrapper.container.focus()
            break

          case '9':
            event.preventDefault()
            setZoom('page-height')
            pdfJsWrapper.container.focus()
            break
        }
      }
    },
    [initialised, setZoom, pdfJsWrapper]
  )

  useMouseWheelZoom(pdfJsWrapper, setScale)

  const requestPresentationMode = usePresentationMode(
    pdfJsWrapper,
    page,
    handlePageChange,
    scale,
    setScale
  )

  // Don't render the toolbar until we have the necessary information
  const toolbarInfoLoaded =
    rawScale !== null && page !== null && totalPages !== null

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
    <div
      className="pdfjs-viewer pdfjs-viewer-outer"
      ref={handleContainer}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="pdfjs-viewer-inner" tabIndex={0} role="tabpanel">
        <div className="pdfViewer" />
      </div>
      {toolbarInfoLoaded && (
        <PdfViewerControlsToolbar
          requestPresentationMode={requestPresentationMode}
          setZoom={setZoom}
          rawScale={rawScale}
          setPage={handlePageChange}
          page={page}
          totalPages={totalPages}
          pdfContainer={pdfJsWrapper?.container}
        />
      )}
    </div>
  )
}

export default withErrorBoundary(memo(PdfJsViewer), () => (
  <PdfPreviewErrorBoundaryFallback type="pdf" />
))
