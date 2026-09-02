import { type ReactNode, useState } from 'react'
import {
  OLDropdown,
  OLDropdownToggle,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'
import { CaretUp, CaretDown } from '@phosphor-icons/react'
import { useDsNavStyle } from '@/features/project-list/components/use-is-ds-nav'

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
  const dsNavStyle = useDsNavStyle()
  // Can't use a NavDropdown here because it's impossible to render the menu as
  // a <ul> element using NavDropdown
  const Caret = show ? CaretUp : CaretDown
  return (
    <OLDropdown
      as="li"
      role="none"
      align="end"
      className={className}
      onToggle={nextShow => {
        setShow(nextShow)
        onToggle?.(nextShow)
      }}
    >
      <OLDropdownToggle role="menuitem">
        {title}
        {dsNavStyle && <Caret weight="bold" className="ms-2" />}
      </OLDropdownToggle>
      <OLDropdownMenu>{children}</OLDropdownMenu>
    </OLDropdown>
  )
}
