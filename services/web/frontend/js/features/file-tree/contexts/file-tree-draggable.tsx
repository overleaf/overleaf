import { useEffect, useState, FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getDroppedFiles from '@uppy/utils/lib/getDroppedFiles'
import { DndProvider, DragSourceMonitor, useDrag, useDrop } from 'react-dnd'
import {
  HTML5Backend,
  getEmptyImage,
  NativeTypes,
} from 'react-dnd-html5-backend'
import {
  findAllInTreeOrThrow,
  findAllFolderIdsInFolders,
} from '../util/find-in-tree'
import { useFileTreeActionable } from './file-tree-actionable'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { isAcceptableFile } from '@/features/file-tree/util/is-acceptable-file'
import { FileTreeFindResult } from '@/features/ide-react/types/file-tree'

const DRAGGABLE_TYPE = 'ENTITY'
export const FileTreeDraggableProvider: FC<{
  fileTreeContainer?: HTMLDivElement
}> = ({ fileTreeContainer, children }) => {
  const options = useMemo(
    () => ({ rootElement: fileTreeContainer }),
    [fileTreeContainer]
  )

  return (
    <DndProvider backend={HTML5Backend} options={options}>
      {children}
    </DndProvider>
  )
}

type DragObject = {
  type: string
  title: string
  forbiddenFolderIds: Set<string>
  draggedEntityIds: Set<string>
}

type DropResult = {
  targetEntityId: string
  dropEffect: DataTransfer['dropEffect']
}

export function useDraggable(draggedEntityId: string) {
  const { t } = useTranslation()

  const { fileTreeData, fileTreeReadOnly } = useFileTreeData()
  const { selectedEntityIds, isRootFolderSelected } = useFileTreeSelectable()
  const { finishMoving } = useFileTreeActionable()

  const [isDraggable, setIsDraggable] = useState(true)

  const [, dragRef, preview] = useDrag({
    type: DRAGGABLE_TYPE,
    item() {
      const draggedEntityIds = getDraggedEntityIds(
        isRootFolderSelected ? new Set() : selectedEntityIds,
        draggedEntityId
      )

      const draggedItems = findAllInTreeOrThrow(fileTreeData, draggedEntityIds)

      return {
        type: DRAGGABLE_TYPE,
        title: getDraggedTitle(draggedItems, t),
        forbiddenFolderIds: getForbiddenFolderIds(draggedItems),
        draggedEntityIds,
      }
    },
    canDrag() {
      return !fileTreeReadOnly && isDraggable
    },
    end(item: DragObject, monitor: DragSourceMonitor<DragObject, DropResult>) {
      if (monitor.didDrop()) {
        const result = monitor.getDropResult()
        if (result) {
          finishMoving(result.targetEntityId, item.draggedEntityIds) // TODO: use result.dropEffect
        }
      }
    },
  })

  // remove the automatic preview as we're using a custom preview via
  // FileTreeDraggablePreviewLayer
  useEffect(() => {
    preview(getEmptyImage())
  }, [preview])

  return { dragRef, setIsDraggable }
}

export function useDroppable(targetEntityId: string) {
  const { setDroppedFiles, startUploadingDocOrFile } = useFileTreeActionable()

  const [{ isOver }, dropRef] = useDrop({
    accept: [DRAGGABLE_TYPE, NativeTypes.FILE],
    canDrop(item: DragObject, monitor) {
      if (!monitor.isOver({ shallow: true })) {
        return false
      }

      return !(
        item.type === DRAGGABLE_TYPE &&
        item.forbiddenFolderIds.has(targetEntityId)
      )
    },
    drop(item, monitor) {
      // monitor.didDrop() returns true if the drop was already handled by a nested child
      if (monitor.didDrop()) {
        return
      }

      // item(s) dragged within the file tree
      if (item.type === DRAGGABLE_TYPE) {
        return { targetEntityId }
      }

      // native file(s) dragged in from outside
      getDroppedFiles(item as unknown as DataTransfer)
        .then(files =>
          files.filter(file =>
            // note: getDroppedFiles normalises webkitRelativePath to relativePath
            isAcceptableFile(file.name, (file as any).relativePath)
          )
        )
        .then(files => {
          setDroppedFiles({ files, targetFolderId: targetEntityId })
          startUploadingDocOrFile()
        })
    },
    collect(monitor) {
      return {
        isOver: monitor.canDrop(),
      }
    },
  })

  return { dropRef, isOver }
}

// Get the list of dragged entity ids. If the dragged entity is one of the
// selected entities then all the selected entites are dragged entities,
// otherwise it's the dragged entity only.
function getDraggedEntityIds(
  selectedEntityIds: Set<string>,
  draggedEntityId: string
) {
  if (selectedEntityIds.size > 1 && selectedEntityIds.has(draggedEntityId)) {
    // dragging the multi-selected entities
    return new Set(selectedEntityIds)
  } else {
    // not dragging the selection; only the current item
    return new Set([draggedEntityId])
  }
}

// Get the draggable title. This is the name of the dragged entities if there's
// only one, otherwise it's the number of dragged entities.
function getDraggedTitle(
  draggedItems: Set<any>,
  t: (key: string, options: Record<string, any>) => void
) {
  if (draggedItems.size === 1) {
    const draggedItem = Array.from(draggedItems)[0]
    return draggedItem.entity.name
  }
  return t('n_items', { count: draggedItems.size })
}

// Get all children folder ids of any of the dragged items.
function getForbiddenFolderIds(draggedItems: Set<FileTreeFindResult>) {
  const draggedFoldersArray = Array.from(draggedItems)
    .filter(draggedItem => {
      return draggedItem.type === 'folder'
    })
    .map(draggedItem => draggedItem.entity)
  const draggedFolders = new Set(draggedFoldersArray)
  return findAllFolderIdsInFolders(draggedFolders)
}
