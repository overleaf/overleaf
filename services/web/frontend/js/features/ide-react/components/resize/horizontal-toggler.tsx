import classNames from 'classnames'
import Tooltip from '@/shared/components/tooltip'

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
    <Tooltip
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
      />
    </Tooltip>
  )
}
