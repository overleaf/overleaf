import { ButtonToolbar, ButtonToolbarProps } from 'react-bootstrap-5'
import {
  ButtonToolbar as BS3ButtonToolbar,
  ButtonToolbarProps as BS3ButtonToolbarProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLButtonToolbarProps = ButtonToolbarProps & {
  bs3Props?: Record<string, unknown>
}

function OLButtonToolbar(props: OLButtonToolbarProps) {
  const { bs3Props, ...rest } = props

  const bs3ButtonToolbarProps: BS3ButtonToolbarProps = {
    children: rest.children,
    className: rest.className,
    ...getAriaAndDataProps(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ButtonToolbar {...bs3ButtonToolbarProps} />}
      bs5={<ButtonToolbar {...rest} />}
    />
  )
}

export default OLButtonToolbar
