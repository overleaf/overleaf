import { useRef } from 'react'

import PdfPageNumberControl from './pdf-page-number-control'
import PdfZoomButtons from './pdf-zoom-buttons'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import useDropdown from '@/shared/hooks/use-dropdown'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'

type PdfViewerControlsMenuButtonProps = {
  setZoom: (zoom: string) => void
  setPage: (page: number) => void
  page: number
  totalPages: number
  pdfContainer?: HTMLDivElement
}

export default function PdfViewerControlsMenuButton({
  setZoom,
  setPage,
  page,
  totalPages,
  pdfContainer,
}: PdfViewerControlsMenuButtonProps) {
  const { t } = useTranslation()

  const {
    open: popoverOpen,
    onToggle: togglePopover,
    ref: popoverRef,
  } = useDropdown()

  const targetRef = useRef<HTMLButtonElement | null>(null)

  return (
    <>
      <OLTooltip
        id="pdf-controls-menu-tooltip"
        description={t('view_options')}
        overlayProps={{ placement: 'bottom' }}
      >
        <OLButton
          variant="ghost"
          className="pdf-toolbar-btn pdfjs-toolbar-popover-button"
          onClick={togglePopover}
          ref={targetRef}
        >
          <MaterialIcon type="more_horiz" />
        </OLButton>
      </OLTooltip>

      <OLOverlay
        show={popoverOpen}
        target={targetRef.current}
        placement="bottom"
        container={pdfContainer}
        containerPadding={0}
        transition
        rootClose
        onHide={() => togglePopover(false)}
      >
        <OLPopover
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
        </OLPopover>
      </OLOverlay>
    </>
  )
}
