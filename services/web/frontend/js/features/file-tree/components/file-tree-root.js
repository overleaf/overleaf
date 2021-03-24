import React, { useEffect } from 'react'
import PropTypes from 'prop-types'

import withErrorBoundary from '../../../infrastructure/error-boundary'
import FileTreeContext from './file-tree-context'
import FileTreeDraggablePreviewLayer from './file-tree-draggable-preview-layer'
import FileTreeFolderList from './file-tree-folder-list'
import FileTreeToolbar from './file-tree-toolbar'
import FileTreeModalDelete from './modals/file-tree-modal-delete'
import FileTreeModalCreateFolder from './modals/file-tree-modal-create-folder'
import FileTreeModalError from './modals/file-tree-modal-error'
import FileTreeContextMenu from './file-tree-context-menu'
import FileTreeError from './file-tree-error'

import { useFileTreeMutable } from '../contexts/file-tree-mutable'
import { useDroppable } from '../contexts/file-tree-draggable'

import { useFileTreeAngularListener } from '../hooks/file-tree-angular-listener'
import { useFileTreeSocketListener } from '../hooks/file-tree-socket-listener'
import FileTreeModalCreateFile from './modals/file-tree-modal-create-file'

function FileTreeRoot({
  projectId,
  rootFolder,
  rootDocId,
  hasWritePermissions,
  userHasFeature,
  refProviders,
  reindexReferences,
  setRefProviderEnabled,
  setStartedFreeTrial,
  onSelect,
  onInit,
  isConnected
}) {
  const isReady = projectId && rootFolder

  useEffect(() => {
    if (isReady) onInit()
  }, [isReady, onInit])
  if (!isReady) return null

  return (
    <FileTreeContext
      projectId={projectId}
      hasWritePermissions={hasWritePermissions}
      userHasFeature={userHasFeature}
      refProviders={refProviders}
      setRefProviderEnabled={setRefProviderEnabled}
      setStartedFreeTrial={setStartedFreeTrial}
      reindexReferences={reindexReferences}
      rootFolder={rootFolder}
      rootDocId={rootDocId}
      onSelect={onSelect}
    >
      {isConnected ? null : <div className="disconnected-overlay" />}
      <FileTreeToolbar />
      <FileTreeContextMenu />
      <div className="file-tree-inner">
        <FileTreeRootFolder />
      </div>
      <FileTreeModalDelete />
      {window.showReactAddFilesModal && <FileTreeModalCreateFile />}
      <FileTreeModalCreateFolder />
      <FileTreeModalError />
    </FileTreeContext>
  )
}

function FileTreeRootFolder() {
  useFileTreeSocketListener()
  useFileTreeAngularListener()
  const { fileTreeData } = useFileTreeMutable()

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
  projectId: PropTypes.string,
  rootFolder: PropTypes.array,
  rootDocId: PropTypes.string,
  hasWritePermissions: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onInit: PropTypes.func.isRequired,
  isConnected: PropTypes.bool.isRequired,
  setRefProviderEnabled: PropTypes.func.isRequired,
  userHasFeature: PropTypes.func.isRequired,
  setStartedFreeTrial: PropTypes.func.isRequired,
  reindexReferences: PropTypes.func.isRequired,
  refProviders: PropTypes.object.isRequired
}

export default withErrorBoundary(FileTreeRoot, FileTreeError)
