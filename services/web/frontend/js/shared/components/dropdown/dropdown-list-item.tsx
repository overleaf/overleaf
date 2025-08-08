import { ReactNode } from 'react'

export default function DropdownListItem({
  children,
}: {
  children: ReactNode
}) {
  return <li role="none">{children}</li>
}
