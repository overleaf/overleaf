import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import { FC, forwardRef, useCallback } from 'react'
import classNames from 'classnames'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'
import { NestableDropdownContextProvider } from '@/shared/context/nestable-dropdown-context'
import { AnchorProps } from 'react-bootstrap'
import MaterialIcon from '../material-icon'
import { OLDropdownMenuProps } from '@/shared/components/types/dropdown-menu-props'

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
    <OLDropdown show={active} align={align} onToggle={onToggle} autoClose>
      <OLDropdownToggle
        id={`${menuId}-${id}`}
        variant="secondary"
        className={classNames(className, 'menu-bar-toggle')}
        onMouseEnter={onHover}
      >
        {title}
      </OLDropdownToggle>
      {active && (
        <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
          {children}
        </NestableDropdownMenu>
      )}
    </OLDropdown>
  )
}

const NestableDropdownMenu: FC<
  React.PropsWithChildren<OLDropdownMenuProps & { id: string }>
> = ({ children, id, ...props }) => {
  return (
    <OLDropdownMenu {...props}>
      <NestableDropdownContextProvider id={id}>
        {children}
      </NestableDropdownContextProvider>
    </OLDropdownMenu>
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
      role="menuitem"
      aria-haspopup
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
    <OLDropdown
      align="start"
      drop="end"
      show={active}
      autoClose
      onToggle={onToggle}
      as="li"
      role="none"
    >
      <OLDropdownToggle
        id={`${menuId}-${id}`}
        onMouseEnter={select}
        className={classNames({ 'nested-dropdown-toggle-shown': active })}
        as={NestedDropdownToggle}
      >
        {title}
      </OLDropdownToggle>
      {active && (
        <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
          {children}
        </NestableDropdownMenu>
      )}
    </OLDropdown>
  )
}
