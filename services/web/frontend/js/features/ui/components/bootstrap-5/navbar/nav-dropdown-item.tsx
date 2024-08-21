import { ReactNode } from 'react'

export default function NavDropdownItem({ children }: { children: ReactNode }) {
  return <li role="none">{children}</li>
}
