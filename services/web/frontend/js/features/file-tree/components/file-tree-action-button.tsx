import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon, {
  AvailableUnfilledIcon,
} from '@/shared/components/material-icon'
import React from 'react'

export default function FileTreeActionButton({
  id,
  description,
  onClick,
  iconType,
  disabled,
}: {
  id: string
  description: string
  onClick: () => void
  iconType: AvailableUnfilledIcon
  disabled?: boolean
}) {
  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      <button
        className="btn file-tree-toolbar-action-button"
        onClick={onClick}
        disabled={disabled}
      >
        <MaterialIcon
          unfilled
          type={iconType}
          accessibilityLabel={description}
        />
      </button>
    </OLTooltip>
  )
}
