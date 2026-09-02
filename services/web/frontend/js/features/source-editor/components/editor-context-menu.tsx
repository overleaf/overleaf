import { FC, Fragment, memo, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { getTooltip } from '@codemirror/view'
import {
  OLDropdown,
  OLDropdownMenu,
  OLDropdownItem,
  OLDropdownDivider,
} from '@/shared/components/ol/ol-dropdown-menu'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import { contextMenuStateField } from '../extensions/context-menu'
import { useContextMenuItems } from '../hooks/use-context-menu-items'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import { sendContextMenuEvent } from '../utils/context-menu-analytics'

const EditorContextMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()

  const menuState = state.field(contextMenuStateField, false)
  if (!menuState?.tooltip) {
    return null
  }

  const tooltipView = getTooltip(view, menuState.tooltip)
  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(<EditorContextMenuContent />, tooltipView.dom)
}

const EditorContextMenuContent: FC = memo(function EditorContextMenuContent() {
  const { menuItems, closeMenu, onToggle } = useContextMenuItems()
  const menuRef = useRef<any>(null)

  useEffect(() => {
    sendContextMenuEvent('menu-expand', {
      location: 'editor-context-menu',
    })
    menuRef.current?.focus()
  }, [])

  return (
    <OLDropdown show onToggle={onToggle}>
      <div onContextMenu={event => event.preventDefault()}>
        <OLDropdownMenu
          ref={menuRef}
          show
          tabIndex={0}
          className="dropdown-menu-unpositioned"
          onKeyDown={event => {
            switch (event.key) {
              case 'Escape':
              case 'Tab':
                event.preventDefault()
                closeMenu()
                break
            }
          }}
        >
          {menuItems.map((menuItem, index) => (
            <Fragment key={index}>
              {menuItem.separatorAbove && <OLDropdownDivider />}
              <DropdownListItem>
                <OLDropdownItem
                  as="button"
                  onClick={() => menuItem.handler()}
                  disabled={menuItem.disabled}
                  trailingIcon={
                    menuItem.shortcut ? (
                      <span>{menuItem.shortcut}</span>
                    ) : undefined
                  }
                >
                  {menuItem.label}
                </OLDropdownItem>
              </DropdownListItem>
            </Fragment>
          ))}
        </OLDropdownMenu>
      </div>
    </OLDropdown>
  )
})

export default EditorContextMenu
