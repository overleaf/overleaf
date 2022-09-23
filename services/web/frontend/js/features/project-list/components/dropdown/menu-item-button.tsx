import { ReactNode } from 'react'

type MenuItemButtonProps = {
  children: ReactNode
  onClick?: (...args: unknown[]) => void
  className?: string
  afterNode?: React.ReactNode
}

export default function MenuItemButton({
  children,
  onClick,
  className,
  afterNode,
}: MenuItemButtonProps) {
  return (
    <li role="presentation" className={className}>
      <button className="menu-item-button" role="menuitem" onClick={onClick}>
        {children}
      </button>
      {afterNode}
    </li>
  )
}
