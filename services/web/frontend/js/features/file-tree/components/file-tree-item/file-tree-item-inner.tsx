import { ReactNode, useEffect, useRef } from 'react'
import classNames from 'classnames'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'

import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { useFileTreeMainContext } from '../../contexts/file-tree-main'
import { useDraggable } from '../../contexts/file-tree-draggable'

import FileTreeItemName from './file-tree-item-name'
import FileTreeItemMenu from './file-tree-item-menu'
import SplitTestBadge from '@/shared/components/split-test-badge'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useFileTreeSelectable } from '../../contexts/file-tree-selectable'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useDragDropManager } from 'react-dnd'

function FileTreeItemInner({
  id,
  name,
  type,
  isSelected,
  icons,
  onClick,
}: {
  id: string
  name: string
  type: string
  isSelected: boolean
  icons?: ReactNode
  onClick?: () => void
}) {
  const { fileTreeReadOnly } = useFileTreeData()
  const { setContextMenuCoords } = useFileTreeMainContext()
  const { isRenaming } = useFileTreeActionable()
  const { selectedEntityIds } = useFileTreeSelectable()

  const hasMenu =
    !fileTreeReadOnly && isSelected && selectedEntityIds.size === 1
  const showMarkdownBadge =
    useFeatureFlag('markdown-visual') &&
    type !== 'folder' &&
    (name.toLowerCase().endsWith('.md') ||
      name.toLowerCase().endsWith('.markdown'))

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
    if (ev.shiftKey) {
      setContextMenuCoords(null)
      return
    }

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
        className={classNames('entity-name', 'entity-name-react', {
          'file-tree-has-beta-badge': showMarkdownBadge,
        })}
        role="presentation"
        ref={itemRef}
      >
        <FileTreeItemIconsAndName
          name={name}
          isSelected={isSelected}
          icons={icons}
          onClick={onClick}
          setIsDraggable={setIsDraggable}
        />
        {showMarkdownBadge && (
          <div className="file-tree-beta-badge text-white">
            <SplitTestBadge
              splitTestName="markdown-visual"
              displayOnVariants={['enabled']}
            />
          </div>
        )}
        {hasMenu ? <FileTreeItemMenu id={id} name={name} /> : null}
      </div>
    </div>
  )
}

const FileTreeItemIconsAndName = ({
  name,
  isSelected,
  icons,
  onClick,
  setIsDraggable,
}: {
  name: string
  isSelected: boolean
  icons?: ReactNode
  onClick?: () => void
  setIsDraggable: (isDraggable: boolean) => void
}) => {
  return onClick ? (
    <button className="file-tree-entity-button" onClick={onClick}>
      {icons}
      <FileTreeItemName
        name={name}
        isSelected={isSelected}
        setIsDraggable={setIsDraggable}
      />
    </button>
  ) : (
    <div className="file-tree-entity-details">
      {icons}
      <FileTreeItemName
        name={name}
        isSelected={isSelected}
        setIsDraggable={setIsDraggable}
      />
    </div>
  )
}

export default FileTreeItemInner
