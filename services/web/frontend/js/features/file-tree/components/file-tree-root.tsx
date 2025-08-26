import React, { useEffect, useState } from 'react'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { useProjectContext } from '../../../shared/context/project-context'
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import FileTreeContext from './file-tree-context'
import FileTreeDraggablePreviewLayer from './file-tree-draggable-preview-layer'
import FileTreeFolderList from './file-tree-folder-list'
import FileTreeToolbar from './file-tree-toolbar'
import FileTreeToolbarNew from '@/features/ide-redesign/components/file-tree/file-tree-toolbar'
import FileTreeModalDelete from './modals/file-tree-modal-delete'
import FileTreeModalCreateFolder from './modals/file-tree-modal-create-folder'
import FileTreeModalError from './modals/file-tree-modal-error'
import FileTreeContextMenu from './file-tree-context-menu'
import FileTreeError from './file-tree-error'
import { useDroppable } from '../contexts/file-tree-draggable'
import { useFileTreeSocketListener } from '../hooks/file-tree-socket-listener'
import FileTreeModalCreateFile from './modals/file-tree-modal-create-file'
import FileTreeInner from './file-tree-inner'
import { useDragLayer } from 'react-dnd'
import classnames from 'classnames'
import { pathInFolder } from '@/features/file-tree/util/path'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'

const FileTreeRoot = React.memo<{
  onSelect: () => void
  onDelete: () => void
  onInit: () => void
  isConnected: boolean
  setRefProviderEnabled: () => void
  setStartedFreeTrial: () => void
  refProviders: Record<string, boolean>
}>(function FileTreeRoot({
  refProviders,
  setRefProviderEnabled,
  setStartedFreeTrial,
  onSelect,
  onInit,
  onDelete,
  isConnected,
}) {
  const [fileTreeContainer, setFileTreeContainer] =
    useState<HTMLDivElement | null>(null)
  const { projectId } = useProjectContext()
  const { fileTreeData } = useFileTreeData()
  const isReady = Boolean(projectId && fileTreeData)
  const newEditor = useIsNewEditorEnabled()

  useEffect(() => {
    if (fileTreeContainer) {
      const listener = (event: DragEvent) => {
        if (event.dataTransfer) {
          // store the dragged entity in dataTransfer
          const { dataset } = event.target as HTMLDivElement
          if (
            dataset.fileId &&
            dataset.fileType &&
            dataset.fileType !== 'folder'
          ) {
            event.dataTransfer.setData(
              'application/x-overleaf-file-id',
              dataset.fileId
            )

            const filePath = pathInFolder(fileTreeData, dataset.fileId)
            if (filePath) {
              event.dataTransfer.setData(
                'application/x-overleaf-file-path',
                filePath
              )
            }
          }
        }
      }

      fileTreeContainer.addEventListener('dragstart', listener)

      return () => {
        fileTreeContainer.removeEventListener('dragstart', listener)
      }
    }
  }, [fileTreeContainer, fileTreeData])

  useEffect(() => {
    if (isReady) onInit()
  }, [isReady, onInit])
  if (!isReady) return null

  return (
    <div
      className="file-tree"
      data-testid="file-tree"
      ref={setFileTreeContainer}
    >
      {fileTreeContainer && (
        <FileTreeContext
          refProviders={refProviders}
          setRefProviderEnabled={setRefProviderEnabled}
          setStartedFreeTrial={setStartedFreeTrial}
          onSelect={onSelect}
          fileTreeContainer={fileTreeContainer}
        >
          {isConnected ? null : <div className="disconnected-overlay" />}
          {newEditor ? <FileTreeToolbarNew /> : <FileTreeToolbar />}
          <FileTreeContextMenu />
          <FileTreeInner>
            <FileTreeRootFolder onDelete={onDelete} />
          </FileTreeInner>
          <FileTreeModalDelete />
          <FileTreeModalCreateFile />
          <FileTreeModalCreateFolder />
          <FileTreeModalError />
        </FileTreeContext>
      )}
    </div>
  )
})

function FileTreeRootFolder({
  onDelete,
}: {
  onDelete: (entity: FileTreeFindResult, isFileRestore?: boolean) => void
}) {
  useFileTreeSocketListener(onDelete)
  const { fileTreeData } = useFileTreeData()

  const { isOver, dropRef } = useDroppable(fileTreeData._id)

  const dragLayer = useDragLayer(monitor => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    clientOffset: monitor.getClientOffset(),
  }))

  return (
    <>
      <FileTreeDraggablePreviewLayer isOver={isOver} {...dragLayer} />
      <FileTreeFolderList
        folders={fileTreeData.folders}
        docs={fileTreeData.docs}
        files={fileTreeData.fileRefs}
        classes={{
          root: classnames('file-tree-list', {
            'file-tree-dragging': dragLayer.isDragging,
          }),
        }}
        dropRef={dropRef}
        dataTestId="file-tree-list-root"
      />
    </>
  )
}

export default withErrorBoundary(FileTreeRoot, FileTreeError)
