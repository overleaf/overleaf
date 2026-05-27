import { forwardRef } from 'react'
import { ListGroupItem, ListGroupItemProps } from 'react-bootstrap'

const OLListGroupItem = forwardRef<HTMLElement, ListGroupItemProps>(
  function OLListGroupItem(props, ref) {
    const as = props.as ?? 'button'

    return (
      <ListGroupItem
        {...props}
        ref={ref}
        as={as}
        type={as === 'button' ? 'button' : undefined}
      />
    )
  }
)

OLListGroupItem.displayName = 'OLListGroupItem'

export default OLListGroupItem
