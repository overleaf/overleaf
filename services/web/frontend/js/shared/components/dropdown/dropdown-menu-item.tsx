import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { OLDropdownItemProps } from '@/shared/components/types/dropdown-menu-props'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'

// This represents a menu item. It wraps the item within an <li> element.
function DropdownMenuItem(props: OLDropdownItemProps) {
  return (
    <DropdownListItem>
      <OLDropdownItem {...props} />
    </DropdownListItem>
  )
}

export default DropdownMenuItem
