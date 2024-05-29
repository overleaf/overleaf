import { ButtonGroup } from 'react-bootstrap'
import PDFToolbarButton from './pdf-toolbar-button'
import { useTranslation } from 'react-i18next'

const isMac = /Mac/.test(window.navigator?.platform)

type PdfZoomButtonsProps = {
  setZoom: (zoom: string) => void
}

function PdfZoomButtons({ setZoom }: PdfZoomButtonsProps) {
  const { t } = useTranslation()

  const zoomInShortcut = isMac ? '⌘+' : 'Ctrl++'
  const zoomOutShortcut = isMac ? '⌘-' : 'Ctrl+-'

  return (
    <ButtonGroup className="pdfjs-toolbar-buttons">
      <PDFToolbarButton
        tooltipId="pdf-controls-zoom-out-tooltip"
        label={t('zoom_out')}
        icon="remove"
        onClick={() => setZoom('zoom-out')}
        shortcut={zoomOutShortcut}
      />
      <PDFToolbarButton
        tooltipId="pdf-controls-zoom-in-tooltip"
        label={t('zoom_in')}
        icon="add"
        onClick={() => setZoom('zoom-in')}
        shortcut={zoomInShortcut}
      />
    </ButtonGroup>
  )
}

export default PdfZoomButtons
