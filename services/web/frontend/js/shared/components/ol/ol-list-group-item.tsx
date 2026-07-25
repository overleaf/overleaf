import { forwardRef, useId } from 'react'
import { ListGroupItem, ListGroupItemProps } from 'react-bootstrap'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

type OLListGroupItemProps = ListGroupItemProps & {
  disabledReason?: string
}

const OLListGroupItem = forwardRef<HTMLElement, OLListGroupItemProps>(
  function OLListGroupItem({ disabledReason, ...props }, ref) {
    const as = props.as ?? 'button'
    const tooltipId = useId()

    const showDisabledTooltip = Boolean(props.disabled && disabledReason)

    const item = (
      <ListGroupItem
        {...props}
        ref={ref}
        as={as}
        type={as === 'button' ? 'button' : undefined}
      />
    )

    if (showDisabledTooltip) {
      return (
        <OLTooltip
          id={tooltipId}
          description={disabledReason}
          overlayProps={{ placement: 'right' }}
        >
          <span className="d-block">{item}</span>
        </OLTooltip>
      )
    }

    return item
  }
)

OLListGroupItem.displayName = 'OLListGroupItem'

export default OLListGroupItem
