import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { DropdownItemProps } from '@/features/ui/components/types/dropdown-menu-props'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'

// This represents a menu item. It wraps the item within an <li> element.
function OLDropdownMenuItem(props: DropdownItemProps) {
  return (
    <DropdownListItem>
      <DropdownItem {...props} />
    </DropdownListItem>
  )
}

export default OLDropdownMenuItem
