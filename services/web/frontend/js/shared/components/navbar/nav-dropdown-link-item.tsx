import { ReactNode } from 'react'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { DropdownItem } from 'react-bootstrap'
import { DropdownItemProps } from 'react-bootstrap/DropdownItem'

export default function NavDropdownLinkItem({
  href,
  onClick,
  children,
}: {
  href: string
  onClick?: DropdownItemProps['onClick']
  children: ReactNode
}) {
  return (
    <DropdownListItem>
      <DropdownItem href={href} role="menuitem" onClick={onClick}>
        {children}
      </DropdownItem>
    </DropdownListItem>
  )
}
