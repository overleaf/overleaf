import React from 'react'
import ReactDOM from 'react-dom'
import { Dropdown } from 'react-bootstrap'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'

function FileTreeContextMenu() {
  const { permissionsLevel } = useEditorContext()
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()

  if (permissionsLevel === 'readOnly' || !contextMenuCoords) return null

  function close() {
    // reset context menu
    setContextMenuCoords(null)
  }

  function handleToggle(wantOpen: boolean) {
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
      dropup={
        document.body.offsetHeight / contextMenuCoords.top < 2 &&
        document.body.offsetHeight - contextMenuCoords.top < 250
      }
      className="context-menu"
      style={contextMenuCoords}
    >
      <FakeDropDownToggle bsRole="toggle" />
      <Dropdown.Menu>
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
