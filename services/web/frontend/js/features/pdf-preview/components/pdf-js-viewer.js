import PropTypes from 'prop-types'
import { memo, useCallback, useEffect, useState } from 'react'
import { debounce } from 'lodash'
import { Alert } from 'react-bootstrap'
import PdfViewerControls from './pdf-viewer-controls'
import { useProjectContext } from '../../../shared/context/project-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { buildHighlightElement } from '../util/highlights'
import PDFJSWrapper from '../util/pdf-js-wrapper'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import ErrorBoundaryFallback from './error-boundary-fallback'

function PdfJsViewer({ url }) {
  const { _id: projectId } = useProjectContext()

  // state values persisted in localStorage to restore on load
  const [scale, setScale] = usePersistedState(
    `pdf-viewer-scale:${projectId}`,
    'page-width'
  )

  // state values shared with Angular scope (highlights => editor, position => synctex buttons
  const [highlights] = useScopeValue('pdf.highlights')
  const [, setPosition] = useScopeValue('pdf.position')

  // local state values
  const [pdfJsWrapper, setPdfJsWrapper] = useState()
  const [initialised, setInitialised] = useState(false)
  const [error, setError] = useState()

  // create the viewer when the container is mounted
  const handleContainer = useCallback(parent => {
    if (parent) {
      const viewer = new PDFJSWrapper(parent.firstChild)
      setPdfJsWrapper(viewer)
      return () => viewer.destroy()
    }
  }, [])

  // listen for initialize event
  useEffect(() => {
    if (pdfJsWrapper) {
      const handlePagesinit = () => setInitialised(true)
      pdfJsWrapper.eventBus.on('pagesinit', handlePagesinit)
      return () => pdfJsWrapper.eventBus.off('pagesinit', handlePagesinit)
    }
  }, [pdfJsWrapper])

  // load the PDF document from the URL
  useEffect(() => {
    if (pdfJsWrapper && url) {
      setInitialised(false)
      setError(undefined)
      // TODO: anything else to be reset?

      pdfJsWrapper.loadDocument(url).catch(error => setError(error))
      return () => pdfJsWrapper.abortDocumentLoading()
    }
  }, [pdfJsWrapper, url])

  // listen for scroll events
  useEffect(() => {
    let storePositionTimer

    if (initialised && pdfJsWrapper) {
      // store the scroll position in localStorage, for the synctex button
      const storePosition = debounce(pdfViewer => {
        // set position for "sync to code" button
        try {
          setPosition(pdfViewer.currentPosition)
        } catch (error) {
          // TODO: investigate handling missing offsetParent in jsdom
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
        const pageElement = textLayer.source.textLayerDiv.closest('.page')

        const doubleClickListener = event => {
          window.dispatchEvent(
            new CustomEvent('synctex:sync-to-position', {
              detail: pdfJsWrapper.clickPosition(event, pageElement, textLayer),
            })
          )
        }

        pageElement.addEventListener('dblclick', doubleClickListener)
      }

      pdfJsWrapper.eventBus.on('textlayerrendered', handleTextlayerrendered)
      return () =>
        pdfJsWrapper.eventBus.off('textlayerrendered', handleTextlayerrendered)
    }
  }, [pdfJsWrapper])

  // restore the saved scale and scroll position
  useEffect(() => {
    if (initialised && pdfJsWrapper) {
      setScale(scale => {
        pdfJsWrapper.viewer.currentScaleValue = scale
        return scale
      })

      // restore the scroll position
      setPosition(position => {
        if (position) {
          pdfJsWrapper.currentPosition = position
        }
        return position
      })
    }
  }, [initialised, setScale, setPosition, pdfJsWrapper])

  // transmit scale value to the viewer when it changes
  useEffect(() => {
    if (pdfJsWrapper) {
      pdfJsWrapper.viewer.currentScaleValue = scale
    }
  }, [scale, pdfJsWrapper])

  // when highlights are created, build the highlight elements
  useEffect(() => {
    if (pdfJsWrapper && highlights?.length) {
      const elements = []

      for (const highlight of highlights) {
        try {
          const element = buildHighlightElement(highlight, pdfJsWrapper.viewer)
          elements.push(element)
        } catch (error) {
          // ignore invalid highlights
        }
      }

      // scroll to the first highlighted element
      elements[0]?.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: 'smooth',
      })

      return () => {
        for (const element of elements) {
          element.remove()
        }
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
          setScale(pdfJsWrapper.viewer.currentScale * 1.25)
          break

        case 'zoom-out':
          setScale(pdfJsWrapper.viewer.currentScale * 0.75)
          break
      }
    },
    [pdfJsWrapper, setScale]
  )

  // adjust the scale when the container is resized
  useEffect(() => {
    if (pdfJsWrapper) {
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
      if ((event.metaKey || event.ctrlKey) && event.key === '=') {
        event.preventDefault()
        setZoom('zoom-in')
      } else if ((event.metaKey || event.ctrlKey) && event.key === '-') {
        event.preventDefault()
        setZoom('zoom-out')
      } else if ((event.metaKey || event.ctrlKey) && event.key === '0') {
        event.preventDefault()
        setZoom('fit-width')
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
      {error && (
        <div className="pdfjs-error">
          <Alert bsStyle="danger">{error.message}</Alert>
        </div>
      )}
    </div>
  )
}

PdfJsViewer.propTypes = {
  url: PropTypes.string.isRequired,
}

export default withErrorBoundary(memo(PdfJsViewer), () => (
  <ErrorBoundaryFallback type="pdf" />
))
