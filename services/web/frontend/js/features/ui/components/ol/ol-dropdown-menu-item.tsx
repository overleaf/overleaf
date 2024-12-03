import { MenuItem, MenuItemProps } from 'react-bootstrap'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { DropdownItemProps } from '@/features/ui/components/types/dropdown-menu-props'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'

type OLDropdownMenuItemProps = DropdownItemProps & {
  bs3Props?: MenuItemProps
}

// This represents a menu item. It wraps the item within an <li> element.
function OLDropdownMenuItem(props: OLDropdownMenuItemProps) {
  const { bs3Props, ...rest } = props

  const bs3MenuItemProps: MenuItemProps = {
    children: rest.leadingIcon ? (
      <>
        {rest.leadingIcon}
        &nbsp;
        {rest.children}
      </>
    ) : (
      rest.children
    ),
    onClick: rest.onClick,
    href: rest.href,
    download: rest.download,
    eventKey: rest.eventKey,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<MenuItem {...bs3MenuItemProps} />}
      bs5={
        <DropdownListItem>
          <DropdownItem {...rest} />
        </DropdownListItem>
      }
    />
  )
}

export default OLDropdownMenuItem
