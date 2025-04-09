import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import { DropdownItem } from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'
import { MouseEventHandler, ReactNode } from 'react'

type MenuBarOptionProps = {
  title: string
  onClick?: MouseEventHandler
  disabled?: boolean
  trailingIcon?: ReactNode
  href?: string
  target?: string
  rel?: string
}

export const MenuBarOption = ({
  title,
  onClick,
  href,
  disabled,
  trailingIcon,
  target,
  rel,
}: MenuBarOptionProps) => {
  const { setSelected } = useNestableDropdown()
  return (
    <DropdownListItem>
      <DropdownItem
        onMouseEnter={() => setSelected(null)}
        onClick={onClick}
        disabled={disabled}
        trailingIcon={trailingIcon}
        href={href}
        rel={rel}
        target={target}
      >
        {title}
      </DropdownItem>
    </DropdownListItem>
  )
}
