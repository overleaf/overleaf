import { useRef } from 'react'
import classNames from 'classnames'
import { XYCoord } from 'react-dnd'

// a custom component rendered on top of a draggable area that renders the
// dragged item. See
// https://react-dnd.github.io/react-dnd/examples/drag-around/custom-drag-layer
// for more details.
// Also used to display a container border when hovered.
function FileTreeDraggablePreviewLayer({
  isOver,
  isDragging,
  item,
  clientOffset,
}: {
  isOver: boolean
  isDragging: boolean
  item: { title: string }
  clientOffset: XYCoord | null
}) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className={classNames('dnd-draggable-preview-layer', {
        'dnd-droppable-hover': isOver,
      })}
    >
      {isDragging && item?.title && (
        <div
          style={getItemStyle(
            clientOffset,
            ref.current?.getBoundingClientRect()
          )}
        >
          <DraggablePreviewItem title={item.title} />
        </div>
      )}
    </div>
  )
}

function DraggablePreviewItem({ title }: { title: string }) {
  return <div className="dnd-draggable-preview-item">{title}</div>
}

// makes the preview item follow the cursor.
// See https://react-dnd.github.io/react-dnd/docs/api/drag-layer-monitor
function getItemStyle(
  clientOffset: XYCoord | null,
  containerOffset: DOMRect | undefined
) {
  if (!containerOffset || !clientOffset) {
    return {
      display: 'none',
    }
  }
  const { x: containerX, y: containerY } = containerOffset
  const { x: clientX, y: clientY } = clientOffset
  const posX = clientX - containerX - 15
  const posY = clientY - containerY - 15
  const transform = `translate(${posX}px, ${posY}px)`
  return {
    transform,
    WebkitTransform: transform,
  }
}

export default FileTreeDraggablePreviewLayer
