import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import PDFToolbarButton from './pdf-toolbar-button'
import OLButtonGroup from '@/shared/components/ol/ol-button-group'

type PdfRotationButtonsProps = {
  rotation: number
  setRotation: (rotation: number) => void
}

function PdfRotationButtons({
  rotation,
  setRotation,
}: PdfRotationButtonsProps) {
  const { t } = useTranslation()

  const rotateClockwise = useCallback(() => {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
  }, [rotation, setRotation])

  const rotateCounterClockwise = useCallback(() => {
    const newRotation = (rotation - 90 + 360) % 360
    setRotation(newRotation)
  }, [rotation, setRotation])

  return (
    <OLButtonGroup className="pdfjs-toolbar-buttons">
      <PDFToolbarButton
        tooltipId="pdf-controls-rotate-counter-clockwise-tooltip"
        label={t('rotate_counter_clockwise')}
        icon="rotate_left"
        onClick={rotateCounterClockwise}
      />
      <PDFToolbarButton
        tooltipId="pdf-controls-rotate-clockwise-tooltip"
        label={t('rotate_clockwise')}
        icon="rotate_right"
        onClick={rotateClockwise}
      />
    </OLButtonGroup>
  )
}

export default PdfRotationButtons
