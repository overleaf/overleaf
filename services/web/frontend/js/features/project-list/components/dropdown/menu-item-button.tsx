import { ReactNode } from 'react'

type MenuItemButtonProps = {
  children: ReactNode
  onClick?: (e?: React.MouseEvent) => void
  className?: string
  afterNode?: React.ReactNode
}

export default function MenuItemButton({
  children,
  onClick,
  className,
  afterNode,
  ...buttonProps
}: MenuItemButtonProps) {
  return (
    <li role="presentation" className={className}>
      <button
        className="menu-item-button"
        role="menuitem"
        onClick={onClick}
        {...buttonProps}
      >
        {children}
      </button>
      {afterNode}
    </li>
  )
}
