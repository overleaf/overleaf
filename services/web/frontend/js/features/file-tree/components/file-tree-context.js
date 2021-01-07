import React from 'react'
import PropTypes from 'prop-types'

import { FileTreeMainProvider } from '../contexts/file-tree-main'
import { FileTreeActionableProvider } from '../contexts/file-tree-actionable'
import { FileTreeMutableProvider } from '../contexts/file-tree-mutable'
import { FileTreeSelectableProvider } from '../contexts/file-tree-selectable'
import { FileTreeDraggableProvider } from '../contexts/file-tree-draggable'

// renders all the contexts needed for the file tree:
// FileTreeMain: generic store
// FileTreeActionable: global UI state for actions (rename, delete, etc.)
// FileTreeMutable: provides entities mutation operations
// FileTreeSelectable: handles selection and multi-selection
function FileTreeContext({
  projectId,
  rootFolder,
  hasWritePermissions,
  rootDocId,
  onSelect,
  children
}) {
  return (
    <FileTreeMainProvider
      projectId={projectId}
      hasWritePermissions={hasWritePermissions}
    >
      <FileTreeActionableProvider hasWritePermissions={hasWritePermissions}>
        <FileTreeMutableProvider rootFolder={rootFolder}>
          <FileTreeSelectableProvider
            hasWritePermissions={hasWritePermissions}
            rootDocId={rootDocId}
            onSelect={onSelect}
          >
            <FileTreeDraggableProvider>{children}</FileTreeDraggableProvider>
          </FileTreeSelectableProvider>
        </FileTreeMutableProvider>
      </FileTreeActionableProvider>
    </FileTreeMainProvider>
  )
}

FileTreeContext.propTypes = {
  projectId: PropTypes.string.isRequired,
  rootFolder: PropTypes.array.isRequired,
  hasWritePermissions: PropTypes.bool.isRequired,
  rootDocId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}

export default FileTreeContext
