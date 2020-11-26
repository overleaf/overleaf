import React, { useContext, useEffect, createRef } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'

import { FileTreeMainContext } from '../../contexts/file-tree-main'
import { useDraggable } from '../../contexts/file-tree-draggable'

import FileTreeItemName from './file-tree-item-name'
import FileTreeItemMenu from './file-tree-item-menu'

function FileTreeItemInner({ id, name, isSelected, icons }) {
  const { hasWritePermissions, setContextMenuCoords } = useContext(
    FileTreeMainContext
  )

  const hasMenu = hasWritePermissions && isSelected

  const { isDragging, dragRef } = useDraggable(id)

  const itemRef = createRef()

  useEffect(
    () => {
      if (isSelected && itemRef.current) {
        scrollIntoViewIfNeeded(itemRef.current, {
          scrollMode: 'if-needed'
        })
      }
    },
    [isSelected, itemRef]
  )

  function handleContextMenu(ev) {
    ev.preventDefault()
    setContextMenuCoords({
      top: ev.pageY,
      left: ev.pageX
    })
  }

  return (
    <div
      className={classNames('entity', {
        'dnd-draggable-dragging': isDragging
      })}
      role="presentation"
      ref={dragRef}
      onContextMenu={handleContextMenu}
    >
      <div
        className="entity-name entity-name-react"
        role="presentation"
        ref={itemRef}
      >
        {icons}
        <FileTreeItemName name={name} isSelected={isSelected} />
        {hasMenu ? <FileTreeItemMenu id={id} /> : null}
      </div>
    </div>
  )
}

FileTreeItemInner.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  icons: PropTypes.node
}

export default FileTreeItemInner
