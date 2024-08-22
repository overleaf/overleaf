import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Dropdown } from 'react-bootstrap'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'

function FileTreeContextMenu() {
  const { fileTreeReadOnly } = useFileTreeData()
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (contextMenuCoords) {
      toggleButtonRef.current = document.querySelector(
        '.entity-menu-toggle'
      ) as HTMLButtonElement | null
      focusContextMenu()
    }
  }, [contextMenuCoords])

  if (!contextMenuCoords || fileTreeReadOnly) return null

  // A11y - Move the focus to the context menu when it opens
  function focusContextMenu() {
    const contextMenu = document.querySelector(
      '[aria-labelledby="dropdown-file-tree-context-menu"]'
    ) as HTMLElement | null
    contextMenu?.focus()
  }

  function close() {
    setContextMenuCoords(null)
    if (toggleButtonRef.current) {
      // A11y - Move the focus back to the toggle button when the context menu closes by pressing the Esc key
      toggleButtonRef.current.focus()
    }
  }

  function handleToggle(wantOpen: boolean) {
    if (!wantOpen) close()
  }

  function handleClick() {
    handleToggle(false)
  }

  // A11y - Close the context menu when the user presses the Tab key
  // Focus should move to the next element in the filetree
  function handleKeyDown(event: React.KeyboardEvent<Dropdown>) {
    if (event.key === 'Tab') {
      close()
    }
  }

  return ReactDOM.createPortal(
    <Dropdown
      onClick={handleClick}
      open
      id="dropdown-file-tree-context-menu"
      onToggle={handleToggle}
      dropup={
        document.body.offsetHeight / contextMenuCoords.top < 2 &&
        document.body.offsetHeight - contextMenuCoords.top < 250
      }
      className="context-menu"
      style={contextMenuCoords}
      onKeyDown={handleKeyDown}
    >
      <FakeDropDownToggle bsRole="toggle" />
      <Dropdown.Menu tabIndex={-1}>
        <FileTreeItemMenuItems />
      </Dropdown.Menu>
    </Dropdown>,
    document.body
  )
}

// fake component required as Dropdowns require a Toggle, even tho we don't want
// one for the context menu
const FakeDropDownToggle = React.forwardRef<undefined, { bsRole: string }>(
  ({ bsRole }, ref) => {
    return null
  }
)

FakeDropDownToggle.displayName = 'FakeDropDownToggle'

export default FileTreeContextMenu
