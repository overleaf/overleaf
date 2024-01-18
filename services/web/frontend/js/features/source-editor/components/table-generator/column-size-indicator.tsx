import MaterialIcon from '@/shared/components/material-icon'
import { WidthSelection } from './toolbar/column-width-modal/column-width'
import { useMemo } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/shared/components/tooltip'
import { useSelectionContext } from './contexts/selection-context'

function roundIfNeeded(width: number) {
  return width.toFixed(2).replace(/\.0+$/, '')
}

export const ColumnSizeIndicator = ({
  size,
  onClick,
}: {
  size: WidthSelection
  onClick: () => void
}) => {
  const { t } = useTranslation()
  const { selection } = useSelectionContext()
  const { unit, width } = size
  const formattedWidth = useMemo(() => {
    if (unit === 'custom') {
      return width
    }
    return `${roundIfNeeded(width)}${unit}`
  }, [unit, width])

  if (!selection) {
    return null
  }

  return (
    <Tooltip
      id="tooltip-column-width-button"
      description={
        unit === 'custom'
          ? t('column_width_is_custom_click_to_resize')
          : t('column_width_is_x_click_to_resize', {
              width: formattedWidth,
            })
      }
      overlayProps={{ delay: 0, placement: 'bottom' }}
    >
      <Button
        bsStyle={null}
        className="table-generator-column-indicator-button"
        onClick={onClick}
      >
        <MaterialIcon
          type="format_text_wrap"
          className="table-generator-column-indicator-icon"
        />
        <span className="table-generator-column-indicator-label">
          {formattedWidth}
        </span>
      </Button>
    </Tooltip>
  )
}
