import { ReactNode } from 'react'
import { Nav } from 'react-bootstrap'
import NavItem from '@/shared/components/navbar/nav-item'

export default function NavLinkItem({
  href,
  className,
  onClick,
  children,
}: {
  href: string
  className?: string
  onClick?: React.ComponentProps<typeof Nav.Link>['onClick']
  children: ReactNode
}) {
  return (
    <NavItem className={className}>
      <Nav.Link role="menuitem" href={href} onClick={onClick}>
        {children}
      </Nav.Link>
    </NavItem>
  )
}
