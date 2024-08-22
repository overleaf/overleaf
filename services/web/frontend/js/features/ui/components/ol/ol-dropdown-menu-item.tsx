import { MenuItem, MenuItemProps } from 'react-bootstrap'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { DropdownItemProps } from '@/features/ui/components/types/dropdown-menu-props'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OlDropdownMenuItemProps = DropdownItemProps & {
  bs3Props?: MenuItemProps
}

function OlDropdownMenuItem(props: OlDropdownMenuItemProps) {
  const { bs3Props, ...rest } = props

  const bs3MenuItemProps: MenuItemProps = {
    children: rest.children,
    onClick: rest.onClick,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<MenuItem {...bs3MenuItemProps} />}
      bs5={<DropdownItem {...rest} />}
    />
  )
}

export default OlDropdownMenuItem
