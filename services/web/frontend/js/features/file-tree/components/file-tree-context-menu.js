import React from 'react'
import ReactDOM from 'react-dom'

import { Dropdown } from 'react-bootstrap'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'

function FileTreeContextMenu() {
  const {
    hasWritePermissions,
    contextMenuCoords,
    setContextMenuCoords,
  } = useFileTreeMainContext()

  if (!hasWritePermissions || !contextMenuCoords) return null

  function close() {
    // reset context menu
    setContextMenuCoords(null)
  }

  function handleToggle(wantOpen) {
    if (!wantOpen) close()
  }

  function handleClick() {
    handleToggle(false)
  }

  return ReactDOM.createPortal(
    <Dropdown
      onClick={handleClick}
      open
      id="dropdown-file-tree-context-menu"
      onToggle={handleToggle}
    >
      <FakeDropDownToggle bsRole="toggle" />
      <Dropdown.Menu className="context-menu" style={contextMenuCoords}>
        <FileTreeItemMenuItems />
      </Dropdown.Menu>
    </Dropdown>,
    document.querySelector('body')
  )
}

// fake component required as Dropdowns require a Toggle, even tho we don't want
// one for the context menu
const FakeDropDownToggle = React.forwardRef((props, ref) => {
  return null
})

FakeDropDownToggle.displayName = 'FakeDropDownToggle'

export default FileTreeContextMenu
