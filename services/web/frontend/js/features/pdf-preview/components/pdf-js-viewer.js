import PropTypes from 'prop-types'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { debounce } from 'lodash'
import PdfViewerControls from './pdf-viewer-controls'
import { useProjectContext } from '../../../shared/context/project-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { buildHighlightElement } from '../util/highlights'
import PDFJSWrapper from '../util/pdf-js-wrapper'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import PdfPreviewErrorBoundaryFallback from './pdf-preview-error-boundary-fallback'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { captureException } from '../../../infrastructure/error-reporter'
import { getPdfCachingMetrics } from '../util/metrics'
import { userContentDomainAccessCheckFailed } from '../../user-content-domain-access-check'
import { isURLOnUserContentDomain } from '../util/fetchFromCompileDomain'
import { isNetworkError } from '../../../utils/isNetworkError'
import OError from '@overleaf/o-error'

function PdfJsViewer({ url, pdfFile }) {
  const { _id: projectId } = useProjectContext()

  const { setError, firstRenderDone, highlights, position, setPosition } =
    useCompileContext()

  // state values persisted in localStorage to restore on load
  const [scale, setScale] = usePersistedState(
    `pdf-viewer-scale:${projectId}`,
    'page-width'
  )

  // local state values
  const [pdfJsWrapper, setPdfJsWrapper] = useState()
  const [initialised, setInitialised] = useState(false)

  // create the viewer when the container is mounted
  const handleContainer = useCallback(
    parent => {
      if (parent) {
        const wrapper = new PDFJSWrapper(parent.firstChild)
        wrapper
          .init()
          .then(() => {
            setPdfJsWrapper(wrapper)
          })
          .catch(error => {
            setError('pdf-viewer-loading-error')
            captureException(error)
          })

        return () => {
          setPdfJsWrapper(null)
          wrapper.destroy()
        }
      }
    },
    [setError]
  )

  const [startFetch, setStartFetch] = useState(0)

  // listen for events and trigger rendering.
  // Do everything in one effect to mitigate de-sync between events.
  useEffect(() => {
    if (!pdfJsWrapper || !firstRenderDone) return

    let timePDFFetched
    let timePDFRendered
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

    // `pagesinit` fires when the data for rendering the first page is ready.
    pdfJsWrapper.eventBus.on('pagesinit', handlePagesinit)
    // `pagerendered` fires when a page was actually rendered.
    pdfJsWrapper.eventBus.on('pagerendered', handleRendered)
    return () => {
      pdfJsWrapper.eventBus.off('pagesinit', handlePagesinit)
      pdfJsWrapper.eventBus.off('pagerendered', handleRendered)
    }
  }, [pdfJsWrapper, firstRenderDone, startFetch])

  // load the PDF document from the URL
  useEffect(() => {
    if (pdfJsWrapper && url) {
      setInitialised(false)
      setError(undefined)
      setStartFetch(performance.now())

      const abortController = new AbortController()
      const handleFetchError = err => {
        if (abortController.signal.aborted) return
        // The error is already logged at the call-site with additional context.
        if (err instanceof pdfJsWrapper.PDFJS.MissingPDFException) {
          if (
            // 404 is unrelated to new domain
            OError.getFullInfo(err).statusCode !== 404 &&
            isURLOnUserContentDomain(OError.getFullInfo(err).url)
          ) {
            setError('rendering-error-new-domain')
          } else {
            setError('rendering-error-expected')
          }
        } else {
          setError('rendering-error')
        }
      }
      pdfJsWrapper
        .loadDocument({ url, pdfFile, abortController, handleFetchError })
        .catch(error => {
          if (abortController.signal.aborted) return
          console.error(error)
          if (
            isURLOnUserContentDomain(url) &&
            error instanceof pdfJsWrapper.PDFJS.UnexpectedResponseException
          ) {
            setError('rendering-error-new-domain')
          } else if (
            isURLOnUserContentDomain(url) &&
            error.name === 'UnknownErrorException' &&
            (isNetworkError(error) || userContentDomainAccessCheckFailed())
          ) {
            // For some reason, pdfJsWrapper.PDFJS.UnknownErrorException is
            //  not available for an instance check.
            setError('rendering-error-new-domain')
          } else {
            setError('rendering-error')
          }
        })
      return () => {
        abortController.abort()
        pdfJsWrapper.abortDocumentLoading()
      }
    }
  }, [pdfJsWrapper, url, pdfFile, setError, setStartFetch])

  // listen for scroll events
  useEffect(() => {
    let storePositionTimer

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
          // console.error(error)
        }
      }, 500)

      storePositionTimer = window.setTimeout(() => {
        storePosition(pdfJsWrapper)
      }, 100)

      const scrollListener = () => {
        storePosition(pdfJsWrapper)
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
      const handleTextlayerrendered = textLayer => {
        // handle both versions for backwards-compatibility
        const textLayerDiv =
          textLayer.source.textLayerDiv ?? textLayer.source.textLayer.div

        const pageElement = textLayerDiv.closest('.page')

        if (!pageElement.dataset.listeningForDoubleClick) {
          pageElement.dataset.listeningForDoubleClick = true

          const doubleClickListener = event => {
            const clickPosition = pdfJsWrapper.clickPosition(
              event,
              pageElement,
              textLayer
            )

            if (clickPosition) {
              window.dispatchEvent(
                new CustomEvent('synctex:sync-to-position', {
                  detail: clickPosition,
                })
              )
            }
          }

          pageElement.addEventListener('dblclick', doubleClickListener)
        }
      }

      pdfJsWrapper.eventBus.on('textlayerrendered', handleTextlayerrendered)
      return () =>
        pdfJsWrapper.eventBus.off('textlayerrendered', handleTextlayerrendered)
    }
  }, [pdfJsWrapper])

  // restore the saved scale and scroll position
  const positionRef = useRef(position)
  useEffect(() => {
    positionRef.current = position
  }, [position])

  const scaleRef = useRef(scale)
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    if (initialised && pdfJsWrapper) {
      if (!pdfJsWrapper.isVisible()) {
        return
      }
      if (positionRef.current) {
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
    const timers = []
    let intersectionObserver

    if (pdfJsWrapper && highlights?.length) {
      // watch for the highlight elements to scroll into view
      intersectionObserver = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              intersectionObserver.unobserve(entry.target)

              // fade the element in and out
              entry.target.style.opacity = '0.5'

              timers.push(
                window.setTimeout(() => {
                  entry.target.style.opacity = '0'
                }, 1000)
              )
            }
          }
        },
        {
          threshold: 1.0, // the whole element must be visible
        }
      )

      const elements = []

      for (const highlight of highlights) {
        try {
          const element = buildHighlightElement(highlight, pdfJsWrapper)
          elements.push(element)
          intersectionObserver.observe(element)
        } catch (error) {
          // ignore invalid highlights
        }
      }

      const [firstElement] = elements

      if (firstElement) {
        // scroll to the first highlighted element
        firstElement.scrollIntoView({
          block: 'center',
          inline: 'start',
          behavior: 'smooth',
        })
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
        case 'fit-width':
          setScale('page-width')
          break

        case 'fit-height':
          setScale('page-height')
          break

        case 'zoom-in':
          if (pdfJsWrapper) {
            setScale(pdfJsWrapper.viewer.currentScale * 1.25)
          }
          break

        case 'zoom-out':
          if (pdfJsWrapper) {
            setScale(pdfJsWrapper.viewer.currentScale * 0.75)
          }
          break
      }
    },
    [pdfJsWrapper, setScale]
  )

  // adjust the scale when the container is resized
  useEffect(() => {
    if (pdfJsWrapper && 'ResizeObserver' in window) {
      const resizeListener = () => {
        pdfJsWrapper.updateOnResize()
      }

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
      if (!initialised) {
        return
      }
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case '=':
            event.preventDefault()
            setZoom('zoom-in')
            break

          case '-':
            event.preventDefault()
            setZoom('zoom-out')
            break

          case '0':
            event.preventDefault()
            setZoom('fit-width')
            break
        }
      }
    },
    [initialised, setZoom]
  )

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    <div className="pdfjs-viewer pdfjs-viewer-outer" ref={handleContainer}>
      <div
        className="pdfjs-viewer-inner"
        role="tabpanel"
        tabIndex="0"
        onKeyDown={handleKeyDown}
      >
        <div className="pdfViewer" />
      </div>
      <div className="pdfjs-controls">
        <PdfViewerControls setZoom={setZoom} />
      </div>
    </div>
  )
}

PdfJsViewer.propTypes = {
  url: PropTypes.string.isRequired,
  pdfFile: PropTypes.object,
}

export default withErrorBoundary(memo(PdfJsViewer), () => (
  <PdfPreviewErrorBoundaryFallback type="pdf" />
))
