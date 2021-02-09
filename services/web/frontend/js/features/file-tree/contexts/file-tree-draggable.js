import React, { useRef, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import { DndProvider, createDndContext, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend, getEmptyImage } from 'react-dnd-html5-backend'

import {
  findAllInTreeOrThrow,
  findAllFolderIdsInFolders
} from '../util/find-in-tree'

import { useFileTreeActionable } from './file-tree-actionable'
import { useFileTreeMutable } from './file-tree-mutable'
import { useFileTreeSelectable } from '../contexts/file-tree-selectable'

// HACK ALERT
// DnD binds drag and drop events on window and stop propagation if the dragged
// item is not a DnD element. This break other drag and drop interfaces; in
// particular in rich text.
// This is a hacky workaround to avoid calling the DnD listeners when the
// draggable or droppable element is not within a `dnd-container` element.
const ModifiedBackend = (...args) => {
  function isDndChild(elt) {
    if (elt.getAttribute && elt.getAttribute('dnd-container')) return true
    if (!elt.parentNode) return false
    return isDndChild(elt.parentNode)
  }
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
    'handleTopDropCapture'
  ]

  dragDropListeners.forEach(dragDropListener => {
    const originalListener = instance[dragDropListener]
    instance[dragDropListener] = (ev, ...extraArgs) => {
      if (isDndChild(ev.target)) originalListener(ev, ...extraArgs)
    }
  })

  return instance
}

const DndContext = createDndContext(ModifiedBackend)

const DRAGGABLE_TYPE = 'ENTITY'

export function FileTreeDraggableProvider({ children }) {
  const DndManager = useRef(DndContext)

  return (
    <DndProvider manager={DndManager.current.dragDropManager}>
      {children}
    </DndProvider>
  )
}

FileTreeDraggableProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]).isRequired
}

export function useDraggable(draggedEntityId) {
  const { t } = useTranslation()

  const { fileTreeData } = useFileTreeMutable()
  const { selectedEntityIds } = useFileTreeSelectable()

  const [isDraggable, setIsDraggable] = useState(true)

  const item = { type: DRAGGABLE_TYPE }
  const [{ isDragging }, dragRef, preview] = useDrag({
    item, // required, but overwritten by the return value of `begin`
    begin: () => {
      const draggedEntityIds = getDraggedEntityIds(
        selectedEntityIds,
        draggedEntityId
      )
      const draggedItems = findAllInTreeOrThrow(fileTreeData, draggedEntityIds)
      const title = getDraggedTitle(draggedItems, t)
      const forbiddenFolderIds = getForbiddenFolderIds(draggedItems)
      return { ...item, title, forbiddenFolderIds, draggedEntityIds }
    },
    collect: monitor => ({
      isDragging: !!monitor.isDragging()
    })
  })

  // remove the automatic preview as we're using a custom preview via
  // FileTreeDraggablePreviewLayer
  useEffect(() => {
    preview(getEmptyImage())
  }, [preview])

  return {
    dragRef,
    isDragging,
    isDraggable,
    setIsDraggable
  }
}

export function useDroppable(droppedEntityId) {
  const { finishMoving } = useFileTreeActionable()

  const [{ isOver }, dropRef] = useDrop({
    accept: DRAGGABLE_TYPE,
    canDrop: (item, monitor) => {
      const isOver = monitor.isOver({ shallow: true })
      if (!isOver) return false
      if (item.forbiddenFolderIds.has(droppedEntityId)) return false
      return true
    },
    drop: (item, monitor) => {
      const didDropInChild = monitor.didDrop()
      if (didDropInChild) return
      finishMoving(droppedEntityId, item.draggedEntityIds)
    },
    collect: monitor => ({
      isOver: monitor.canDrop()
    })
  })

  return {
    dropRef,
    isOver
  }
}

// Get the list of dragged entity ids. If the dragged entity is one of the
// selected entities then all the selected entites are dragged entities,
// otherwise it's the dragged entity only.
function getDraggedEntityIds(selectedEntityIds, draggedEntityId) {
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
function getDraggedTitle(draggedItems, t) {
  if (draggedItems.size === 1) {
    const draggedItem = Array.from(draggedItems)[0]
    return draggedItem.entity.name
  }
  return t('n_items', { count: draggedItems.size })
}

// Get all children folder ids of any of the dragged items.
function getForbiddenFolderIds(draggedItems) {
  const draggedFoldersArray = Array.from(draggedItems)
    .filter(draggedItem => {
      return draggedItem.type === 'folder'
    })
    .map(draggedItem => draggedItem.entity)
  const draggedFolders = new Set(draggedFoldersArray)
  return findAllFolderIdsInFolders(draggedFolders)
}
