import classNames from 'classnames'
import React from 'react'
import { bsVersion } from '@/features/utils/bootstrap-5'
import unfilledIconTypes from '../../../fonts/material-symbols/unfilled-symbols.mjs'

export type AvailableUnfilledIcon = (typeof unfilledIconTypes)[number]

type BaseIconProps = React.ComponentProps<'i'> & {
  accessibilityLabel?: string
  modifier?: string
  size?: '2x'
}

type FilledIconProps = BaseIconProps & {
  type: string
  unfilled?: false
}

type UnfilledIconProps = BaseIconProps & {
  type: AvailableUnfilledIcon
  unfilled: true
}

type IconProps = FilledIconProps | UnfilledIconProps

function MaterialIcon({
  type,
  className,
  accessibilityLabel,
  modifier,
  size,
  unfilled,
  ...rest
}: IconProps) {
  const iconClassName = classNames('material-symbols', className, modifier, {
    [`size-${size}`]: size,
    unfilled,
  })

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
