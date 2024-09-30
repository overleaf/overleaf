import { ToggleButtonGroup, ToggleButtonGroupProps } from 'react-bootstrap-5'
import BS3ToggleButtonGroup from '@/features/ui/components/bootstrap-3/toggle-button-group'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type BS3ToggleButtonGroupProps = React.ComponentProps<
  typeof BS3ToggleButtonGroup
>

type OLToggleButtonGroupProps<T> = ToggleButtonGroupProps<T> & {
  bs3Props?: BS3ToggleButtonGroupProps
}

function OLToggleButtonGroup<T>(props: OLToggleButtonGroupProps<T>) {
  const { bs3Props, ...rest } = props

  const bs3ToggleButtonGroupProps = {
    name: rest.name,
    type: rest.type,
    value: rest.value,
    onChange: rest.onChange,
    children: rest.children,
    className: rest.className,
    defaultValue: rest.defaultValue,
    defaultChecked: rest.defaultChecked,
    ...bs3Props,
  } as BS3ToggleButtonGroupProps

  // Get all `aria-*` and `data-*` attributes
  const extraProps = getAriaAndDataProps(rest)

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3ToggleButtonGroup {...extraProps} {...bs3ToggleButtonGroupProps} />
      }
      bs5={<ToggleButtonGroup {...rest} />}
    />
  )
}

export default OLToggleButtonGroup
