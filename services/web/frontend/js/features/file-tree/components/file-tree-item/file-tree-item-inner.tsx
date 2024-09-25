import { ReactNode, useEffect, useRef } from 'react'
import classNames from 'classnames'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'

import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../../contexts/file-tree-main'
import { useDraggable } from '../../contexts/file-tree-draggable'

import FileTreeItemName from './file-tree-item-name'
import FileTreeItemMenu from './file-tree-item-menu'
import { useFileTreeSelectable } from '../../contexts/file-tree-selectable'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useDragDropManager } from 'react-dnd'

function FileTreeItemInner({
  id,
  name,
  type,
  isSelected,
  icons,
}: {
  id: string
  name: string
  type: string
  isSelected: boolean
  icons?: ReactNode
}) {
  const { fileTreeReadOnly } = useFileTreeData()
  const { setContextMenuCoords } = useFileTreeMainContext()
  const { isRenaming } = useFileTreeActionable()

  const { selectedEntityIds } = useFileTreeSelectable()

  const hasMenu =
    !fileTreeReadOnly && isSelected && selectedEntityIds.size === 1

  const { dragRef, setIsDraggable } = useDraggable(id)

  const dragDropItem = useDragDropManager().getMonitor().getItem()

  const itemRef = useRef<HTMLDivElement | null>(null)

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

  function handleContextMenu(ev: React.MouseEvent<HTMLDivElement>) {
    ev.preventDefault()

    setContextMenuCoords({
      top: ev.pageY,
      left: ev.pageX,
    })
  }

  return (
    <div
      className={classNames('entity', {
        'file-tree-entity-dragging': dragDropItem?.draggedEntityIds?.has(id),
      })}
      role="presentation"
      ref={dragRef}
      draggable={!isRenaming}
      onContextMenu={handleContextMenu}
      data-file-id={id}
      data-file-type={type}
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
        {hasMenu ? <FileTreeItemMenu id={id} name={name} /> : null}
      </div>
    </div>
  )
}

export default FileTreeItemInner
