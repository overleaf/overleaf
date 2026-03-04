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
}: {
  id: string
  description: string
  onClick: () => void
  iconType: AvailableUnfilledIcon
}) {
  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      <button className="btn file-tree-toolbar-action-button" onClick={onClick}>
        <MaterialIcon
          unfilled
          type={iconType}
          accessibilityLabel={description}
        />
      </button>
    </OLTooltip>
  )
}
