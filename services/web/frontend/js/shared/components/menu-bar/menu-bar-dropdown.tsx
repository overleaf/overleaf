import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import { FC, forwardRef, useCallback } from 'react'
import classNames from 'classnames'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'
import { NestableDropdownContextProvider } from '@/shared/context/nestable-dropdown-context'
import { AnchorProps } from 'react-bootstrap'
import MaterialIcon from '../material-icon'
import { DropdownMenuProps } from '@/shared/components/types/dropdown-menu-props'

type MenuBarDropdownProps = {
  title: string
  id: string
  className?: string
  align?: 'start' | 'end'
}

export const MenuBarDropdown: FC<
  React.PropsWithChildren<MenuBarDropdownProps>
> = ({ title, children, id, className, align = 'start' }) => {
  const { menuId, selected, setSelected } = useNestableDropdown()

  const onToggle = useCallback(
    (show: boolean) => {
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

  const active = selected === id
  return (
    <Dropdown show={active} align={align} onToggle={onToggle} autoClose>
      <DropdownToggle
        id={`${menuId}-${id}`}
        variant="secondary"
        className={classNames(className, 'menu-bar-toggle')}
        onMouseEnter={onHover}
      >
        {title}
      </DropdownToggle>
      {active && (
        <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
          {children}
        </NestableDropdownMenu>
      )}
    </Dropdown>
  )
}

const NestableDropdownMenu: FC<
  React.PropsWithChildren<DropdownMenuProps & { id: string }>
> = ({ children, id, ...props }) => {
  return (
    <DropdownMenu {...props}>
      <NestableDropdownContextProvider id={id}>
        {children}
      </NestableDropdownContextProvider>
    </DropdownMenu>
  )
}

const NestedDropdownToggle: FC<React.PropsWithChildren> = forwardRef<
  HTMLAnchorElement,
  AnchorProps
>(function NestedDropdownToggle(
  { children, className, onMouseEnter, id },
  ref
) {
  return (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a
      id={id}
      href="#"
      ref={ref}
      onMouseEnter={onMouseEnter}
      onClick={onMouseEnter}
      className={classNames(
        className,
        'nested-dropdown-toggle',
        'dropdown-item'
      )}
    >
      {children}
      <MaterialIcon type="chevron_right" />
    </a>
  )
})

export const NestedMenuBarDropdown: FC<
  React.PropsWithChildren<{ id: string; title: string }>
> = ({ children, id, title }) => {
  const { menuId, selected, setSelected } = useNestableDropdown()
  const select = useCallback(() => {
    setSelected(id)
  }, [id, setSelected])
  const onToggle = useCallback(
    (show: boolean) => {
      // Only handle opening
      if (show) {
        setSelected(id)
      }
    },
    [setSelected, id]
  )
  const active = selected === id
  return (
    <Dropdown
      align="start"
      drop="end"
      show={active}
      autoClose
      onToggle={onToggle}
    >
      <DropdownToggle
        id={`${menuId}-${id}`}
        onMouseEnter={select}
        className={classNames({ 'nested-dropdown-toggle-shown': active })}
        as={NestedDropdownToggle}
      >
        {title}
      </DropdownToggle>
      {active && (
        <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
          {children}
        </NestableDropdownMenu>
      )}
    </Dropdown>
  )
}
