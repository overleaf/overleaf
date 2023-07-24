import classnames from 'classnames'
import { createPortal } from 'react-dom'
import { Coordinates } from '../hooks/use-indicator-hover'

function EntryContainer({
  id,
  className,
  hoverCoords,
  ...rest
}: React.ComponentProps<'div'> & {
  hoverCoords?: Coordinates | null
}) {
  const container = (
    <div
      className={classnames('rp-entry-wrapper', className)}
      data-entry-id={id}
      {...rest}
    />
  )

  if (hoverCoords) {
    // Render in a floating positioned container
    return createPortal(
      <div
        className="rp-floating-entry"
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
