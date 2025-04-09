import { ListGroup, ListGroupProps } from 'react-bootstrap-5'

function OLListGroup(props: ListGroupProps) {
  const as = props.as ?? 'div'

  return <ListGroup {...props} as={as} />
}

export default OLListGroup
