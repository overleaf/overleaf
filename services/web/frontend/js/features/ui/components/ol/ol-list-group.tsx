import { ListGroup, ListGroupProps } from 'react-bootstrap'

function OLListGroup(props: ListGroupProps) {
  const as = props.as ?? 'div'

  return <ListGroup {...props} as={as} />
}

export default OLListGroup
