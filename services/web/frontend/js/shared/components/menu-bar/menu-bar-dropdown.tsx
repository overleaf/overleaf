import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import { FC, forwardRef, useCallback, useEffect, useRef } from 'react'
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

const NestedDropdownToggle = forwardRef<HTMLAnchorElement, AnchorProps>(
  function NestedDropdownToggle(
    { children, className, onMouseEnter, id, ...rest },
    ref
  ) {
    return (
      // eslint-disable-next-line jsx-a11y/anchor-is-valid
      <a
        id={id}
        href="#"
        ref={ref}
        {...rest}
        onMouseEnter={onMouseEnter}
        onClick={onMouseEnter}
        className={classNames(
          className,
          'nested-dropdown-toggle',
          'dropdown-item'
        )}
        role="menuitem"
        aria-haspopup="menu"
      >
        {children}
        <MaterialIcon type="chevron_right" />
      </a>
    )
  }
)

export const NestedMenuBarDropdown: FC<
  React.PropsWithChildren<{
    id: string
    title: string
    drop?: 'start' | 'end'
  }>
> = ({ children, id, title, drop = 'end' }) => {
  const { menuId, selected, setSelected } = useNestableDropdown()
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  const select = useCallback(() => {
    clearCloseTimer()
    setSelected(id)
  }, [id, setSelected, clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setSelected(prev => (prev === id ? null : prev))
    }, 150)
  }, [clearCloseTimer, setSelected, id])

  const onToggle = useCallback(
    (show: boolean) => {
      if (show) {
        setSelected(id)
      }
    },
    [setSelected, id]
  )

  const active = selected === id

  return (
    <li
      role="none"
      onPointerLeave={e => {
        if (e.pointerType !== 'touch') scheduleClose()
      }}
      onMouseEnter={clearCloseTimer}
    >
      <OLDropdown
        align="start"
        drop={drop}
        show={active}
        autoClose
        onToggle={onToggle}
        className="w-100"
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
    </li>
  )
}
