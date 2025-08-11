import Tooltip from '@/shared/components/tooltip'
import { ComponentProps, memo, MouseEventHandler } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { PreventSelectingEntry } from '@/features/review-panel/components/review-panel-prevent-selecting'
import MaterialIcon from '@/shared/components/material-icon'

const changeActionTooltipProps: Partial<ComponentProps<typeof Tooltip>> = {
  overlayProps: { placement: 'bottom' },
  tooltipProps: { className: 'review-panel-tooltip' },
}

export const ChangeAction = memo<{
  id: string
  label: string
  type: string
  handleClick: MouseEventHandler<HTMLButtonElement>
}>(function ChangeAction({ id, label, type, handleClick }) {
  return (
    <PreventSelectingEntry>
      <OLTooltip id={id} description={label} {...changeActionTooltipProps}>
        <button
          type="button"
          className="btn"
          onClick={handleClick}
          tabIndex={0}
        >
          <MaterialIcon
            type={type}
            className="review-panel-entry-actions-icon"
            accessibilityLabel={label}
          />
        </button>
      </OLTooltip>
    </PreventSelectingEntry>
  )
})
