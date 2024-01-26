import { useRef, useEffect, useState, FC } from 'react'
import { useTranslation } from 'react-i18next'
import getDroppedFiles from '@uppy/utils/lib/getDroppedFiles'
import { DndProvider, createDndContext, useDrag, useDrop } from 'react-dnd'
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
import { useFileTreeData } from '../../../shared/context/file-tree-data-context'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'
import { useEditorContext } from '../../../shared/context/editor-context'

// HACK ALERT
// DnD binds drag and drop events on window and stop propagation if the dragged
// item is not a DnD element. This break other drag and drop interfaces; in
// particular in rich text.
// This is a hacky workaround to avoid calling the DnD listeners when the
// draggable or droppable element is not within a `dnd-container` element.
const ModifiedBackend = (...args: any[]) => {
  function isDndChild(elt: Element): boolean {
    if (elt.getAttribute && elt.getAttribute('dnd-container')) return true
    if (!elt.parentNode) return false
    return isDndChild(elt.parentNode as Element)
  }
  // @ts-ignore
  const instance = new HTML5Backend(...args)

  const dragDropListeners = [
    'handleTopDragStart',
    'handleTopDragStartCapture',
    'handleTopDragEndCapture',
    'handleTopDragEnter',
    'handleTopDragEnterCapture',
    'handleTopDragLeaveCapture',
    'handleTopDragOver',
    'handleTopDragOverCapture',
    'handleTopDrop',
    'handleTopDropCapture',
  ]

  dragDropListeners.forEach(dragDropListener => {
    const originalListener = instance[dragDropListener]
    instance[dragDropListener] = (ev: Event, ...extraArgs: any[]) => {
      if (isDndChild(ev.target as Element)) originalListener(ev, ...extraArgs)
    }
  })

  return instance
}

const DndContext = createDndContext(ModifiedBackend)

const DRAGGABLE_TYPE = 'ENTITY'
export const FileTreeDraggableProvider: FC = ({ children }) => {
  const DndManager = useRef(DndContext)

  return (
    <DndProvider manager={DndManager.current.dragDropManager!}>
      {children}
    </DndProvider>
  )
}

export function useDraggable(draggedEntityId: string) {
  const { t } = useTranslation()

  const { permissionsLevel } = useEditorContext()
  const { fileTreeData } = useFileTreeData()
  const { selectedEntityIds, isRootFolderSelected } = useFileTreeSelectable()

  const [isDraggable, setIsDraggable] = useState(true)

  const item = { type: DRAGGABLE_TYPE }
  const [{ isDragging, draggedEntityIds }, dragRef, preview] = useDrag({
    item, // required, but overwritten by the return value of `begin`
    begin: () => {
      const draggedEntityIds = getDraggedEntityIds(
        isRootFolderSelected ? new Set() : selectedEntityIds,
        draggedEntityId
      )
      const draggedItems = findAllInTreeOrThrow(fileTreeData, draggedEntityIds)
      const title = getDraggedTitle(draggedItems, t)
      const forbiddenFolderIds = getForbiddenFolderIds(draggedItems)
      return { ...item, title, forbiddenFolderIds, draggedEntityIds }
    },
    collect: monitor => ({
      isDragging: !!monitor.isDragging(),
      draggedEntityIds: monitor.getItem()?.draggedEntityIds,
    }),
    canDrag: () => permissionsLevel !== 'readOnly' && isDraggable,
    end: () => item,
  })

  // remove the automatic preview as we're using a custom preview via
  // FileTreeDraggablePreviewLayer
  useEffect(() => {
    preview(getEmptyImage())
  }, [preview])

  return {
    dragRef,
    isDragging,
    setIsDraggable,
    draggedEntityIds,
  }
}

export function useDroppable(droppedEntityId: string) {
  const { finishMoving, setDroppedFiles, startUploadingDocOrFile } =
    useFileTreeActionable()

  const [{ isOver }, dropRef] = useDrop<any, any, any>({
    accept: [DRAGGABLE_TYPE, NativeTypes.FILE],
    canDrop: (item, monitor) => {
      const isOver = monitor.isOver({ shallow: true })
      if (!isOver) return false
      if (
        item.type === DRAGGABLE_TYPE &&
        item.forbiddenFolderIds.has(droppedEntityId)
      )
        return false
      return true
    },
    drop: (item, monitor) => {
      const didDropInChild = monitor.didDrop()
      if (didDropInChild) return
      if (item.type === DRAGGABLE_TYPE) {
        finishMoving(droppedEntityId, item.draggedEntityIds)
      } else {
        getDroppedFiles(item).then(files => {
          setDroppedFiles({ files, targetFolderId: droppedEntityId })
          startUploadingDocOrFile()
        })
      }
    },
    collect: monitor => ({
      isOver: monitor.canDrop(),
    }),
  })

  return {
    dropRef,
    isOver,
  }
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
function getForbiddenFolderIds(draggedItems: Set<any>) {
  const draggedFoldersArray = Array.from(draggedItems)
    .filter(draggedItem => {
      return draggedItem.type === 'folder'
    })
    .map(draggedItem => draggedItem.entity)
  const draggedFolders = new Set(draggedFoldersArray)
  return findAllFolderIdsInFolders(draggedFolders)
}
