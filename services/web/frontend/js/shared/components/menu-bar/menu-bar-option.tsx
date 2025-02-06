import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'

type MenuBarOptionProps = {
  title: string
  onClick?: () => void
}

export const MenuBarOption = ({ title, onClick }: MenuBarOptionProps) => {
  return (
    <DropdownListItem>
      <DropdownItem onClick={onClick}>{title}</DropdownItem>
    </DropdownListItem>
  )
}
