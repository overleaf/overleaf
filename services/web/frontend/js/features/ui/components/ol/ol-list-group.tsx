import { ListGroup, ListGroupProps } from 'react-bootstrap-5'
import {
  ListGroup as BS3ListGroup,
  ListGroupProps as BS3ListGroupProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLListGroupProps = ListGroupProps & {
  bs3Props?: BS3ListGroupProps
}

function OLListGroup(props: OLListGroupProps) {
  const { bs3Props, ...rest } = props

  const bs3ListGroupProps: BS3ListGroupProps = {
    children: rest.children,
    role: rest.role,
    componentClass: rest.as,
    ...bs3Props,
  }

  const extraProps = getAriaAndDataProps(rest)
  const as = rest.as ?? 'div'

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ListGroup {...bs3ListGroupProps} {...extraProps} />}
      bs5={<ListGroup {...rest} as={as} />}
    />
  )
}

export default OLListGroup
