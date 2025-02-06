import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { FC, useCallback } from 'react'
import classNames from 'classnames'
import { useMenuBar } from '@/shared/hooks/use-menu-bar'

type MenuBarDropdownProps = {
  title: string
  id: string
  className?: string
}

export const MenuBarDropdown: FC<MenuBarDropdownProps> = ({
  title,
  children,
  id,
  className,
}) => {
  const { menuId, selected, setSelected } = useMenuBar()

  const onToggle = useCallback(
    show => {
      setSelected(show ? id : null)
    },
    [id, setSelected]
  )

  const onHover = useCallback(() => {
    setSelected(prev => {
      if (prev === null) {
        return null
      }
      return id
    })
  }, [id, setSelected])

  return (
    <Dropdown show={selected === id} align="start" onToggle={onToggle}>
      <DropdownToggle
        id={`${menuId}-${id}`}
        variant="secondary"
        className={classNames(className, 'menu-bar-toggle')}
        onMouseEnter={onHover}
      >
        {title}
      </DropdownToggle>
      <DropdownMenu renderOnMount>{children}</DropdownMenu>
    </Dropdown>
  )
}
