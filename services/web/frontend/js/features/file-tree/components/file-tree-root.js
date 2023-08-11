import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

import withErrorBoundary from '../../../infrastructure/error-boundary'
import { useProjectContext } from '../../../shared/context/project-context'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import FileTreeContext from './file-tree-context'
import FileTreeDraggablePreviewLayer from './file-tree-draggable-preview-layer'
import FileTreeFolderList from './file-tree-folder-list'
import FileTreeToolbar from './file-tree-toolbar'
import FileTreeModalDelete from './modals/file-tree-modal-delete'
import FileTreeModalCreateFolder from './modals/file-tree-modal-create-folder'
import FileTreeModalError from './modals/file-tree-modal-error'
import FileTreeContextMenu from './file-tree-context-menu'
import FileTreeError from './file-tree-error'

import { useDroppable } from '../contexts/file-tree-draggable'

import { useFileTreeSocketListener } from '../hooks/file-tree-socket-listener'
import FileTreeModalCreateFile from './modals/file-tree-modal-create-file'

const FileTreeRoot = React.memo(function FileTreeRoot({
  refProviders,
  reindexReferences,
  setRefProviderEnabled,
  setStartedFreeTrial,
  onSelect,
  onInit,
  isConnected,
}) {
  const { _id: projectId } = useProjectContext(projectContextPropTypes)
  const { fileTreeData } = useFileTreeData()
  const isReady = projectId && fileTreeData

  useEffect(() => {
    if (isReady) onInit()
  }, [isReady, onInit])
  if (!isReady) return null

  return (
    <FileTreeContext
      refProviders={refProviders}
      setRefProviderEnabled={setRefProviderEnabled}
      setStartedFreeTrial={setStartedFreeTrial}
      reindexReferences={reindexReferences}
      onSelect={onSelect}
    >
      {isConnected ? null : <div className="disconnected-overlay" />}
      <FileTreeToolbar />
      <FileTreeContextMenu />
      <div className="file-tree-inner">
        <FileTreeRootFolder />
      </div>
      <FileTreeModalDelete />
      <FileTreeModalCreateFile />
      <FileTreeModalCreateFolder />
      <FileTreeModalError />
    </FileTreeContext>
  )
})

function FileTreeRootFolder() {
  useFileTreeSocketListener()
  const { fileTreeData } = useFileTreeData()

  const { isOver, dropRef } = useDroppable(fileTreeData._id)

  return (
    <>
      <FileTreeDraggablePreviewLayer isOver={isOver} />
      <FileTreeFolderList
        folders={fileTreeData.folders}
        docs={fileTreeData.docs}
        files={fileTreeData.fileRefs}
        classes={{ root: 'file-tree-list' }}
        dropRef={dropRef}
        isOver={isOver}
      >
        <li className="bottom-buffer" />
      </FileTreeFolderList>
    </>
  )
}

FileTreeRoot.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onInit: PropTypes.func.isRequired,
  isConnected: PropTypes.bool.isRequired,
  setRefProviderEnabled: PropTypes.func.isRequired,
  setStartedFreeTrial: PropTypes.func.isRequired,
  reindexReferences: PropTypes.func.isRequired,
  refProviders: PropTypes.object.isRequired,
}

const projectContextPropTypes = {
  _id: PropTypes.string.isRequired,
}

export default withErrorBoundary(FileTreeRoot, FileTreeError)
