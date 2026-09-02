import { ReactNode } from 'react'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { OLDropdownItemProps } from '@/shared/components/types/dropdown-menu-props'

export default function NavDropdownLinkItem({
  href,
  onClick,
  openInNewWindow,
  children,
}: {
  href: string
  onClick?: OLDropdownItemProps['onClick']
  openInNewWindow?: boolean
  children: ReactNode
}) {
  const newWindowAttrs = openInNewWindow
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
  return (
    <DropdownListItem>
      <OLDropdownItem
        href={href}
        role="menuitem"
        onClick={onClick}
        {...newWindowAttrs}
      >
        {children}
      </OLDropdownItem>
    </DropdownListItem>
  )
}
