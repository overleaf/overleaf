import { type ReactNode, useState } from 'react'
import { Dropdown } from 'react-bootstrap-5'
import { CaretUp, CaretDown } from '@phosphor-icons/react'
import { useIsDsNav } from '@/features/project-list/components/use-is-ds-nav'

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
  const [show, setShow] = useState(false)
  const isDsNav = useIsDsNav()
  // Can't use a NavDropdown here because it's impossible to render the menu as
  // a <ul> element using NavDropdown
  const Caret = show ? CaretUp : CaretDown
  return (
    <Dropdown
      as="li"
      role="none"
      className={className}
      onToggle={nextShow => {
        setShow(nextShow)
        onToggle?.(nextShow)
      }}
    >
      <Dropdown.Toggle role="menuitem">
        {title}
        {isDsNav && (
          <Caret weight="bold" className="ms-2 navbar-dropdown-caret" />
        )}
      </Dropdown.Toggle>
      <Dropdown.Menu as="ul" role="menu" align="end">
        {children}
      </Dropdown.Menu>
    </Dropdown>
  )
}
