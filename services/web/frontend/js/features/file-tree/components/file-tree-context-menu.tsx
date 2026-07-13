import React, { useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  OLDropdown,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'
import classNames from 'classnames'

function FileTreeContextMenu() {
  const { fileTreeReadOnly } = useFileTreeData()
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const keyboardInputRef = useRef(false)

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

  const handleShiftContextMenu = useCallback(
    (event: MouseEvent) => {
      if (event.shiftKey) {
        setContextMenuCoords(null)
      }
    },
    [setContextMenuCoords]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('contextmenu', handleShiftContextMenu)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('contextmenu', handleShiftContextMenu)
    }
  }, [handleKeyDown, handleMouseDown, handleShiftContextMenu])

  if (!contextMenuCoords || fileTreeReadOnly) return null

  const dropDirection =
    document.body.offsetHeight / contextMenuCoords.top < 2 &&
    document.body.offsetHeight - contextMenuCoords.top < 250
      ? 'up'
      : 'down'

  return ReactDOM.createPortal(
    <div style={contextMenuCoords} className="context-menu">
      <OLDropdown
        show
        drop={dropDirection}
        onKeyDown={handleClose}
        onToggle={handleToggle}
      >
        <OLDropdownMenu
          className={classNames('dropdown-menu-sm-width', {
            // We have to manually add a class to handle upwards context menu styling
            // due to the way that this dropdown is positioned with absolute coordinates and
            // not relative to a toggle
            'context-menu-upwards': dropDirection === 'up',
          })}
          id="dropdown-file-tree-context-menu"
        >
          <FileTreeItemMenuItems />
        </OLDropdownMenu>
      </OLDropdown>
    </div>,
    document.body
  )
}

export default FileTreeContextMenu
