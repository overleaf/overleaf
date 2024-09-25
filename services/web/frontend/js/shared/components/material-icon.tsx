import classNames from 'classnames'
import React from 'react'
import { bsVersion } from '@/features/utils/bootstrap-5'

type IconProps = React.ComponentProps<'i'> & {
  type: string
  accessibilityLabel?: string
  modifier?: string
}

function MaterialIcon({
  type,
  className,
  accessibilityLabel,
  modifier,
  ...rest
}: IconProps) {
  const iconClassName = classNames('material-symbols', className, modifier)

  return (
    <>
      <span className={iconClassName} aria-hidden="true" {...rest}>
        {type}
      </span>
      {accessibilityLabel && (
        <span className={bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })}>
          {accessibilityLabel}
        </span>
      )}
    </>
  )
}

export default MaterialIcon
