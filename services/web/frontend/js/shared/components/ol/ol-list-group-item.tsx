import { ListGroupItem, ListGroupItemProps } from 'react-bootstrap'

function OLListGroupItem(props: ListGroupItemProps) {
  const as = props.as ?? 'button'

  return (
    <ListGroupItem
      {...props}
      as={as}
      type={as === 'button' ? 'button' : undefined}
    />
  )
}

export default OLListGroupItem
