import { memo, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import PdfPageNumberControl from './pdf-page-number-control'
import PdfZoomButtons from './pdf-zoom-buttons'
import PdfZoomDropdown from './pdf-zoom-dropdown'
import { useResizeObserver } from '@/shared/hooks/use-resize-observer'
import PdfViewerControlsMenuButton from './pdf-viewer-controls-menu-button'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'

type PdfViewerControlsToolbarProps = {
  requestPresentationMode: () => void
  setZoom: (zoom: string) => void
  rawScale: number
  setPage: (page: number) => void
  page: number
  totalPages: number
  pdfContainer?: HTMLDivElement
}

function PdfViewerControlsToolbar({
  requestPresentationMode,
  setZoom,
  rawScale,
  setPage,
  page,
  totalPages,
  pdfContainer,
}: PdfViewerControlsToolbarProps) {
  const { showLogs } = useCompileContext()

  const toolbarControlsElement = document.querySelector('#toolbar-pdf-controls')

  const [availableWidth, setAvailableWidth] = useState<number>(1000)

  const handleResize = useCallback(
    element => {
      setAvailableWidth(element.offsetWidth)
    },
    [setAvailableWidth]
  )

  const { elementRef: pdfControlsRef } = useResizeObserver(handleResize)

  if (!toolbarControlsElement) {
    return null
  }

  if (showLogs) {
    return null
  }

  const InnerControlsComponent =
    availableWidth >= 300
      ? PdfViewerControlsToolbarFull
      : PdfViewerControlsToolbarSmall

  return createPortal(
    <div className="pdfjs-viewer-controls" ref={pdfControlsRef}>
      <InnerControlsComponent
        requestPresentationMode={requestPresentationMode}
        setZoom={setZoom}
        rawScale={rawScale}
        setPage={setPage}
        page={page}
        totalPages={totalPages}
        pdfContainer={pdfContainer}
      />
    </div>,

    toolbarControlsElement
  )
}

type InnerControlsProps = {
  requestPresentationMode: () => void
  setZoom: (zoom: string) => void
  rawScale: number
  setPage: (page: number) => void
  page: number
  totalPages: number
  // eslint-disable-next-line react/no-unused-prop-types
  pdfContainer?: HTMLDivElement
}

function PdfViewerControlsToolbarFull({
  requestPresentationMode,
  setZoom,
  rawScale,
  setPage,
  page,
  totalPages,
}: InnerControlsProps) {
  return (
    <>
      <PdfPageNumberControl
        setPage={setPage}
        page={page}
        totalPages={totalPages}
      />
      <div className="pdfjs-zoom-controls">
        <PdfZoomButtons setZoom={setZoom} />
        <PdfZoomDropdown
          requestPresentationMode={requestPresentationMode}
          rawScale={rawScale}
          setZoom={setZoom}
        />
      </div>
    </>
  )
}

function PdfViewerControlsToolbarSmall({
  requestPresentationMode,
  setZoom,
  rawScale,
  setPage,
  page,
  totalPages,
  pdfContainer,
}: InnerControlsProps) {
  return (
    <div className="pdfjs-viewer-controls-small">
      <PdfZoomDropdown
        requestPresentationMode={requestPresentationMode}
        rawScale={rawScale}
        setZoom={setZoom}
      />
      <PdfViewerControlsMenuButton
        setZoom={setZoom}
        setPage={setPage}
        page={page}
        totalPages={totalPages}
        pdfContainer={pdfContainer}
      />
    </div>
  )
}

export default memo(PdfViewerControlsToolbar)
