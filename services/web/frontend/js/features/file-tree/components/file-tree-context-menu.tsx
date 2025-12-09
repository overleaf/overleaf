import React, { useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  Dropdown,
  DropdownMenu,
} from '@/shared/components/dropdown/dropdown-menu'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'
import classNames from 'classnames'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

function FileTreeContextMenu() {
  const { fileTreeReadOnly } = useFileTreeData()
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const keyboardInputRef = useRef(false)
  const newEditor = useIsNewEditorEnabled()

  useEffect(() => {
    if (contextMenuCoords) {
      toggleButtonRef.current = document.querySelector(
        '.entity-menu-toggle'
      ) as HTMLButtonElement | null
    }
  }, [contextMenuCoords])

  useEffect(() => {
    if (contextMenuCoords && keyboardInputRef.current) {
      const firstDropdownMenuItem = document.querySelector(
        '#dropdown-file-tree-context-menu .dropdown-item:not([disabled])'
      ) as HTMLButtonElement | null

      if (firstDropdownMenuItem) {
        firstDropdownMenuItem.focus()
      }
    }
  }, [contextMenuCoords])

  function close() {
    if (!contextMenuCoords) return
    setContextMenuCoords(null)

    if (toggleButtonRef.current) {
      // A11y - Focus moves back to the trigger button when the context menu is dismissed
      toggleButtonRef.current.focus()
    }
  }

  function handleToggle(wantOpen: boolean) {
    if (!wantOpen) close()
  }

  function handleClose(event: React.KeyboardEvent<Element>) {
    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const handleKeyDown = useCallback(() => {
    keyboardInputRef.current = true
  }, [])

  const handleMouseDown = useCallback(() => {
    keyboardInputRef.current = false
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [handleKeyDown, handleMouseDown])

  if (!contextMenuCoords || fileTreeReadOnly) return null

  const dropDirection =
    document.body.offsetHeight / contextMenuCoords.top < 2 &&
    document.body.offsetHeight - contextMenuCoords.top < 250
      ? 'up'
      : 'down'

  return ReactDOM.createPortal(
    <div
      style={contextMenuCoords}
      // TODO ide-redesign-cleanup: remove 'ide-redesign-main' class when old editor is removed
      // It is only used to apply dark theme styles to the context menu in the new editor
      className={classNames('context-menu', { 'ide-redesign-main': newEditor })}
    >
      <Dropdown
        show
        drop={dropDirection}
        onKeyDown={handleClose}
        onToggle={handleToggle}
      >
        <DropdownMenu
          className={classNames('dropdown-menu-sm-width', {
            // We have to manually add a class to handle upwards context menu styling
            // due to the way that this dropdown is positioned with absolute coordinates and
            // not relative to a toggle
            'context-menu-upwards': dropDirection === 'up',
          })}
          id="dropdown-file-tree-context-menu"
        >
          <FileTreeItemMenuItems />
        </DropdownMenu>
      </Dropdown>
    </div>,
    document.body
  )
}

export default FileTreeContextMenu
