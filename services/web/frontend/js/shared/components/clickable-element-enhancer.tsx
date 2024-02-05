import { useRef, useEffect } from 'react'
import PolymorphicComponent, {
  PolymorphicComponentProps,
} from '@/shared/components/polymorphic-component'
import { MergeAndOverride } from '../../../../types/utils'

// Performs a click event on elements that has been clicked,
// but when releasing the mouse button are no longer hovered
// by the cursor (which by default cancels the event).

type ClickableElementEnhancerOwnProps = {
  onClick: () => void
  onMouseDown?: (e: React.MouseEvent) => void
  offset?: number
}

type ClickableElementEnhancerProps<E extends React.ElementType> =
  MergeAndOverride<
    PolymorphicComponentProps<E>,
    ClickableElementEnhancerOwnProps
  >

function ClickableElementEnhancer<E extends React.ElementType>({
  onClick,
  onMouseDown,
  offset = 50, // the offset around the clicked element which should still trigger the click
  ...rest
}: ClickableElementEnhancerProps<E>) {
  const isClickedRef = useRef(false)
  const elRectRef = useRef<DOMRect>()
  const restProps = rest as PolymorphicComponentProps<E>

  const handleMouseDown = (e: React.MouseEvent) => {
    isClickedRef.current = true
    elRectRef.current = (e.target as HTMLElement).getBoundingClientRect()
    onMouseDown?.(e)
  }

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (isClickedRef.current) {
        isClickedRef.current = false

        if (!elRectRef.current) {
          return
        }

        const halfWidth = elRectRef.current.width / 2
        const halfHeight = elRectRef.current.height / 2

        const centerX = elRectRef.current.x + halfWidth
        const centerY = elRectRef.current.y + halfHeight

        const deltaX = Math.abs(e.clientX - centerX)
        const deltaY = Math.abs(e.clientY - centerY)

        // Check if the mouse has moved significantly from the element position
        if (deltaX < halfWidth + offset && deltaY < halfHeight + offset) {
          // If the mouse hasn't moved much, consider it a click
          onClick()
        }
      }
    }

    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onClick, offset])

  return <PolymorphicComponent onMouseDown={handleMouseDown} {...restProps} />
}

export default ClickableElementEnhancer
