import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { DropdownItem } from '@/shared/components/dropdown/dropdown-menu'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useNestableDropdown } from '@/shared/hooks/use-nestable-dropdown'
import { MouseEventHandler, ReactNode, useCallback } from 'react'

type MenuBarOptionProps = {
  title: string
  onClick?: MouseEventHandler
  disabled?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  href?: string
  target?: string
  rel?: string
  eventKey?: string
}

export const MenuBarOption = ({
  title,
  onClick: clickHandler,
  href,
  disabled,
  leadingIcon,
  trailingIcon,
  target,
  rel,
  eventKey,
}: MenuBarOptionProps) => {
  const { setSelected } = useNestableDropdown()
  const { sendEvent } = useEditorAnalytics()
  const onClick: MouseEventHandler = useCallback(
    e => {
      if (eventKey) {
        sendEvent('menu-bar-option-click', { key: eventKey })
      }
      return clickHandler?.(e)
    },
    [clickHandler, eventKey, sendEvent]
  )
  return (
    <DropdownListItem>
      <DropdownItem
        onMouseEnter={() => setSelected(null)}
        onClick={onClick}
        disabled={disabled}
        leadingIcon={leadingIcon}
        trailingIcon={trailingIcon}
        href={href}
        rel={rel}
        target={target}
      >
        {title}
      </DropdownItem>
    </DropdownListItem>
  )
}
