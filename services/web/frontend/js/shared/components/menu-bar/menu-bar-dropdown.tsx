import {
  Dropdown,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { FC, forwardRef, useCallback } from 'react'
import classNames from 'classnames'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'
import { NestableDropdownContextProvider } from '@/shared/context/nestable-dropdown-context'
import { AnchorProps } from 'react-bootstrap-5'
import MaterialIcon from '../material-icon'
import { DropdownMenuProps } from '@/features/ui/components/types/dropdown-menu-props'

type MenuBarDropdownProps = {
  title: string
  id: string
  className?: string
  align?: 'start' | 'end'
}

export const MenuBarDropdown: FC<MenuBarDropdownProps> = ({
  title,
  children,
  id,
  className,
  align = 'start',
}) => {
  const { menuId, selected, setSelected } = useNestableDropdown()

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
    <Dropdown
      show={selected === id}
      align={align}
      onToggle={onToggle}
      autoClose
    >
      <DropdownToggle
        id={`${menuId}-${id}`}
        variant="secondary"
        className={classNames(className, 'menu-bar-toggle')}
        onMouseEnter={onHover}
      >
        {title}
      </DropdownToggle>
      <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
        {children}
      </NestableDropdownMenu>
    </Dropdown>
  )
}

const NestableDropdownMenu: FC<DropdownMenuProps & { id: string }> = ({
  children,
  id,
  ...props
}) => {
  return (
    <DropdownMenu {...props}>
      <NestableDropdownContextProvider id={id}>
        {children}
      </NestableDropdownContextProvider>
    </DropdownMenu>
  )
}

const NestedDropdownToggle: FC = forwardRef<HTMLAnchorElement, AnchorProps>(
  function NestedDropdownToggle(
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
  }
)

export const NestedMenuBarDropdown: FC<{ id: string; title: string }> = ({
  children,
  id,
  title,
}) => {
  const { menuId, selected, setSelected } = useNestableDropdown()
  const select = useCallback(() => {
    setSelected(id)
  }, [id, setSelected])
  const onToggle = useCallback(
    show => {
      setSelected(show ? id : null)
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
      <NestableDropdownMenu renderOnMount id={`${menuId}-${id}`}>
        {children}
      </NestableDropdownMenu>
    </Dropdown>
  )
}
