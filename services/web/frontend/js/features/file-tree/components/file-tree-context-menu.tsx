import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { Dropdown as BS3Dropdown } from 'react-bootstrap'
import {
  Dropdown,
  DropdownMenu,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
    const BS3contextMenu = document.querySelector(
      '[aria-labelledby="dropdown-file-tree-context-menu"]'
    ) as HTMLElement | null
    BS3contextMenu?.focus()
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
  function handleKeyDown(event: React.KeyboardEvent<BS3Dropdown | Element>) {
    if (event.key === 'Tab') {
      close()
    }
  }

  return ReactDOM.createPortal(
    <BootstrapVersionSwitcher
      bs3={
        <BS3Dropdown
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
          <BS3Dropdown.Menu tabIndex={-1}>
            <FileTreeItemMenuItems />
          </BS3Dropdown.Menu>
        </BS3Dropdown>
      }
      bs5={
        <div style={contextMenuCoords} className="context-menu">
          <Dropdown
            show
            drop={
              document.body.offsetHeight / contextMenuCoords.top < 2 &&
              document.body.offsetHeight - contextMenuCoords.top < 250
                ? 'up'
                : 'down'
            }
            focusFirstItemOnShow // A11y - Focus the first item in the context menu when it opens since the menu is rendered at the root level
            onKeyDown={handleKeyDown}
            onToggle={handleToggle}
          >
            <DropdownMenu
              className="dropdown-menu-sm-width"
              id="dropdown-file-tree-context-menu"
            >
              <FileTreeItemMenuItems />
            </DropdownMenu>
          </Dropdown>
        </div>
      }
    />,
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
