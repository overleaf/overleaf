import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'

type MenuBarOptionProps = {
  title: string
  onClick?: () => void
}

export const MenuBarOption = ({ title, onClick }: MenuBarOptionProps) => {
  const { setSelected } = useNestableDropdown()
  return (
    <DropdownListItem>
      <DropdownItem onMouseEnter={() => setSelected(null)} onClick={onClick}>
        {title}
      </DropdownItem>
    </DropdownListItem>
  )
}
