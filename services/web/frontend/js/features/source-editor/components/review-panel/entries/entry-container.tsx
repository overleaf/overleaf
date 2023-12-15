import classNames from 'classnames'
import { createPortal } from 'react-dom'
import { useReviewPanelValueContext } from '@/features/source-editor/context/review-panel/review-panel-context'
import { Coordinates } from '../hooks/use-indicator-hover'

function EntryContainer({
  id,
  className,
  hoverCoords,
  ...rest
}: React.ComponentProps<'div'> & {
  hoverCoords?: Coordinates | null
}) {
  const { layoutToLeft } = useReviewPanelValueContext()

  const container = (
    <div
      className={classNames('rp-entry-wrapper', className)}
      data-entry-id={id}
      {...rest}
    />
  )

  if (hoverCoords) {
    // Render in a floating positioned container
    return createPortal(
      <div
        className={classNames('rp-floating-entry', {
          'rp-floating-entry-layout-left': layoutToLeft,
        })}
        style={{ left: hoverCoords.x + 'px', top: hoverCoords.y + 'px' }}
      >
        {container}
      </div>,
      document.body
    )
  } else {
    return container
  }
}

export default EntryContainer
