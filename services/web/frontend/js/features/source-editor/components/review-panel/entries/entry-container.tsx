import classNames from 'classnames'
import { createPortal } from 'react-dom'
import { Coordinates } from '../hooks/use-indicator-hover'
import useScopeValue from '@/shared/hooks/use-scope-value'

function EntryContainer({
  id,
  className,
  hoverCoords,
  ...rest
}: React.ComponentProps<'div'> & {
  hoverCoords?: Coordinates | null
}) {
  const [layoutToLeft] = useScopeValue<boolean>('reviewPanel.layoutToLeft')

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
