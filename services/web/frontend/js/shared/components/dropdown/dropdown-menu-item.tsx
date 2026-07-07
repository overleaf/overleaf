import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import { DropdownItemProps } from '@/shared/components/types/dropdown-menu-props'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'

// This represents a menu item. It wraps the item within an <li> element.
function DropdownMenuItem(props: DropdownItemProps) {
  return (
    <DropdownListItem>
      <DropdownItem {...props} />
    </DropdownListItem>
  )
}

export default DropdownMenuItem
