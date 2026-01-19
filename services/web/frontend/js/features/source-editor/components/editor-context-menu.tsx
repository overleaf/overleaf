import { FC, Fragment, memo, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { getTooltip } from '@codemirror/view'
import {
  Dropdown,
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
} from '@/shared/components/dropdown/dropdown-menu'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import { contextMenuStateField } from '../extensions/context-menu'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useContextMenuItems } from '../hooks/use-context-menu-items'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'

const EditorContextMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const editorContextMenuEnabled = useFeatureFlag('editor-context-menu')

  const menuState = state.field(contextMenuStateField, false)
  if (!editorContextMenuEnabled || !menuState?.tooltip) {
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
    menuRef.current?.focus()
  }, [])

  return (
    <Dropdown show onToggle={onToggle}>
      <DropdownMenu
        ref={menuRef}
        show
        tabIndex={0}
        className="dropdown-menu-unpositioned"
        onKeyDown={event => {
          switch (event.code) {
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
            {menuItem.separatorAbove && <DropdownDivider />}
            <DropdownListItem>
              <DropdownItem
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
              </DropdownItem>
            </DropdownListItem>
          </Fragment>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
})

export default EditorContextMenu
