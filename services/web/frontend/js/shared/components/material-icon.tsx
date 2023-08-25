import classNames from 'classnames'
import React from 'react'

type IconOwnProps = {
  type: string
  category?: 'rounded' | 'outlined'
  accessibilityLabel?: string
}

type IconProps = IconOwnProps &
  Omit<React.ComponentProps<'i'>, keyof IconOwnProps>

function MaterialIcon({
  type,
  category = 'rounded',
  className,
  accessibilityLabel,
  ...rest
}: IconProps) {
  const iconClassName = classNames(
    'material-symbols',
    `material-symbols-${category}`,
    className
  )

  return (
    <>
      <span className={iconClassName} aria-hidden="true" {...rest}>
        {type}
      </span>
      {accessibilityLabel && (
        <span className="sr-only">{accessibilityLabel}</span>
      )}
    </>
  )
}

export default MaterialIcon
