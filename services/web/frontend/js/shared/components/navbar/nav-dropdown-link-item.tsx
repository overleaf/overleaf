import { ReactNode } from 'react'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { DropdownItem } from 'react-bootstrap'
import { DropdownItemProps } from 'react-bootstrap/DropdownItem'

export default function NavDropdownLinkItem({
  href,
  onClick,
  openInNewWindow,
  children,
}: {
  href: string
  onClick?: DropdownItemProps['onClick']
  openInNewWindow?: boolean
  children: ReactNode
}) {
  const newWindowAttrs = openInNewWindow
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
  return (
    <DropdownListItem>
      <DropdownItem
        href={href}
        role="menuitem"
        onClick={onClick}
        {...newWindowAttrs}
      >
        {children}
      </DropdownItem>
    </DropdownListItem>
  )
}
