import React, { useEffect, createRef } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'

import { useFileTreeMainContext } from '../../contexts/file-tree-main'
import { useDraggable } from '../../contexts/file-tree-draggable'

import FileTreeItemName from './file-tree-item-name'
import FileTreeItemMenu from './file-tree-item-menu'

function FileTreeItemInner({ id, name, isSelected, icons }) {
  const { hasWritePermissions, setContextMenuCoords } = useFileTreeMainContext()

  const hasMenu = hasWritePermissions && isSelected

  const { isDragging, dragRef, isDraggable, setIsDraggable } = useDraggable(id)

  const itemRef = createRef()

  useEffect(() => {
    const item = itemRef.current
    if (isSelected && item) {
      // we're delaying scrolling due to a race condition with other elements,
      // mainly the Outline, being resized inside the same panel, causing the
      // FileTree to have its viewport shrinked after the selected item is
      // scrolled into the view, hiding it again.
      // See `left-pane-resize-all` in `file-tree-controller` for more information.
      setTimeout(() => {
        if (item) {
          scrollIntoViewIfNeeded(item, {
            scrollMode: 'if-needed',
          })
        }
      }, 100)
    }
  }, [isSelected, itemRef])

  function handleContextMenu(ev) {
    ev.preventDefault()
    setContextMenuCoords({
      top: ev.pageY,
      left: ev.pageX,
    })
  }

  return (
    <div
      className={classNames('entity', {
        'dnd-draggable-dragging': isDragging,
      })}
      role="presentation"
      ref={dragRef}
      onContextMenu={handleContextMenu}
      draggable={isDraggable}
    >
      <div
        className="entity-name entity-name-react"
        role="presentation"
        ref={itemRef}
      >
        {icons}
        <FileTreeItemName
          name={name}
          isSelected={isSelected}
          setIsDraggable={setIsDraggable}
        />
        {hasMenu ? <FileTreeItemMenu id={id} /> : null}
      </div>
    </div>
  )
}

FileTreeItemInner.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  icons: PropTypes.node,
}

export default FileTreeItemInner
