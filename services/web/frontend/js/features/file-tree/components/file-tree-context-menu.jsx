import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import { Dropdown } from 'react-bootstrap'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useFileTreeMainContext } from '../contexts/file-tree-main'

import FileTreeItemMenuItems from './file-tree-item/file-tree-item-menu-items'

function FileTreeContextMenu() {
  const { permissionsLevel } = useEditorContext(editorContextPropTypes)
  const { contextMenuCoords, setContextMenuCoords } = useFileTreeMainContext()

  if (permissionsLevel === 'readOnly' || !contextMenuCoords) return null

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

const editorContextPropTypes = {
  permissionsLevel: PropTypes.oneOf(['readOnly', 'readAndWrite', 'owner']),
}

// fake component required as Dropdowns require a Toggle, even tho we don't want
// one for the context menu
const FakeDropDownToggle = React.forwardRef((props, ref) => {
  return null
})

FakeDropDownToggle.displayName = 'FakeDropDownToggle'

export default FileTreeContextMenu
