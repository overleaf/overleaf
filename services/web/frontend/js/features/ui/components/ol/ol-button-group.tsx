import { ButtonGroup, ButtonGroupProps } from 'react-bootstrap-5'

function OLButtonGroup({ as, ...rest }: ButtonGroupProps) {
  return <ButtonGroup {...rest} as={as} />
}

export default OLButtonGroup
