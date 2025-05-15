import { ButtonGroup, ButtonGroupProps } from 'react-bootstrap'

function OLButtonGroup({ as, ...rest }: ButtonGroupProps) {
  return <ButtonGroup {...rest} as={as} />
}

export default OLButtonGroup
