import classNames from 'classnames'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'

type HorizontalTogglerType = 'west' | 'east'

type HorizontalTogglerProps = {
  id: string
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  togglerType: HorizontalTogglerType
  tooltipWhenOpen: string
  tooltipWhenClosed: string
}

export function HorizontalToggler({
  id,
  isOpen,
  setIsOpen,
  togglerType,
  tooltipWhenOpen,
  tooltipWhenClosed,
}: HorizontalTogglerProps) {
  const description = isOpen ? tooltipWhenOpen : tooltipWhenClosed

  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{
        placement: togglerType === 'east' ? 'left' : 'right',
      }}
    >
      <button
        className={classNames(
          'custom-toggler',
          `custom-toggler-${togglerType}`,
          {
            'custom-toggler-open': isOpen,
            'custom-toggler-closed': !isOpen,
          }
        )}
        aria-label={description}
        title=""
        onClick={() => setIsOpen(!isOpen)}
      >
        <MaterialIcon
          type={
            (togglerType === 'west' && isOpen) ||
            (togglerType === 'east' && !isOpen)
              ? 'chevron_left'
              : 'chevron_right'
          }
        />
      </button>
    </OLTooltip>
  )
}
