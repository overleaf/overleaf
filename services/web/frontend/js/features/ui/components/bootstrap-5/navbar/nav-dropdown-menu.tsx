import { ReactNode } from 'react'
import { Dropdown } from 'react-bootstrap-5'

export default function NavDropdownMenu({
  title,
  className,
  children,
  onToggle,
}: {
  title: string
  className?: string
  children: ReactNode
  onToggle?: (nextShow: boolean) => void
}) {
  // Can't use a NavDropdown here because it's impossible to render the menu as
  // a <ul> element using NavDropdown
  return (
    <Dropdown as="li" role="none" className={className} onToggle={onToggle}>
      <Dropdown.Toggle role="menuitem">{title}</Dropdown.Toggle>
      <Dropdown.Menu as="ul" role="menu" align="end">
        {children}
      </Dropdown.Menu>
    </Dropdown>
  )
}
