import { useRef } from 'react'

import PdfPageNumberControl from './pdf-page-number-control'
import PdfZoomButtons from './pdf-zoom-buttons'
import { Button, Overlay, Popover } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import Tooltip from '@/shared/components/tooltip'
import useDropdown from '@/shared/hooks/use-dropdown'

type PdfViewerControlsMenuButtonProps = {
  setZoom: (zoom: string) => void
  setPage: (page: number) => void
  page: number
  totalPages: number
}

export default function PdfViewerControlsMenuButton({
  setZoom,
  setPage,
  page,
  totalPages,
}: PdfViewerControlsMenuButtonProps) {
  const { t } = useTranslation()

  const {
    open: popoverOpen,
    onToggle: togglePopover,
    ref: popoverRef,
  } = useDropdown()

  const targetRef = useRef<any>(null)

  return (
    <>
      <Tooltip
        id="pdf-controls-menu-tooltip"
        description={t('view_options')}
        overlayProps={{ placement: 'bottom' }}
      >
        <Button
          className="pdf-toolbar-btn pdfjs-toolbar-popover-button"
          onClick={togglePopover}
          ref={targetRef}
        >
          <MaterialIcon type="more_horiz" />
        </Button>
      </Tooltip>

      <Overlay
        show={popoverOpen}
        target={targetRef.current}
        placement="bottom"
        containerPadding={0}
        animation
        rootClose
        onHide={() => togglePopover(false)}
      >
        <Popover
          className="pdfjs-toolbar-popover"
          id="pdf-toolbar-popover-menu"
          ref={popoverRef}
        >
          <PdfPageNumberControl
            setPage={setPage}
            page={page}
            totalPages={totalPages}
          />
          <div className="pdfjs-zoom-controls">
            <PdfZoomButtons setZoom={setZoom} />
          </div>
        </Popover>
      </Overlay>
    </>
  )
}
