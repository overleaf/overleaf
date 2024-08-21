import { ReactNode } from 'react'
import NavDropdownItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-item'
import { DropdownItem } from 'react-bootstrap-5'
import { DropdownItemProps } from 'react-bootstrap-5/DropdownItem'

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
    <NavDropdownItem>
      <DropdownItem href={href} role="menuitem" onClick={onClick}>
        {children}
      </DropdownItem>
    </NavDropdownItem>
  )
}
