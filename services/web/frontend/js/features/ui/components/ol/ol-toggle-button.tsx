import { ToggleButton, ToggleButtonProps } from 'react-bootstrap-5'
import {
  ToggleButton as BS3ToggleButton,
  ToggleButtonProps as BS3ToggleButtonProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'
import classnames from 'classnames'

type OLToggleButtonProps = ToggleButtonProps & {
  bs3Props?: BS3ToggleButtonProps
}

function OLToggleButton(props: OLToggleButtonProps) {
  const { bs3Props, ...rest } = props

  const bs3ToggleButtonProps: BS3ToggleButtonProps & { active?: boolean } = {
    type: rest.type,
    name: rest.name,
    active: rest.active,
    checked: rest.checked,
    disabled: rest.disabled,
    onChange: rest.onChange as BS3ToggleButtonProps['onChange'],
    onClick: rest.onClick as BS3ToggleButtonProps['onClick'],
    value: rest.value as BS3ToggleButtonProps['value'],
    children: rest.children,
    className: classnames(`btn-${props.variant || 'primary'}`, rest.className),
    ...bs3Props,
  }

  // Get all `aria-*` and `data-*` attributes
  const extraProps = getAriaAndDataProps(rest)

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3ToggleButton
          {...extraProps}
          {...bs3ToggleButtonProps}
          bsStyle={null}
        />
      }
      bs5={<ToggleButton {...rest} />}
    />
  )
}

export default OLToggleButton
