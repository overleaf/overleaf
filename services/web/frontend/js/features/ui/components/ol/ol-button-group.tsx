import { ButtonGroup, ButtonGroupProps } from 'react-bootstrap-5'
import {
  ButtonGroup as BS3ButtonGroup,
  ButtonGroupProps as BS3ButtonGroupProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLButtonGroupProps = ButtonGroupProps & {
  bs3Props?: Record<string, unknown>
}

function OLButtonGroup({ bs3Props, as, ...rest }: OLButtonGroupProps) {
  const bs3ButtonGroupProps: BS3ButtonGroupProps = {
    children: rest.children,
    className: rest.className,
    vertical: rest.vertical,
    ...getAriaAndDataProps(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ButtonGroup {...bs3ButtonGroupProps} />}
      bs5={<ButtonGroup {...rest} as={as} />}
    />
  )
}

export default OLButtonGroup
