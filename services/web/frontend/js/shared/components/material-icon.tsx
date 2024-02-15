import classNames from 'classnames'
import React from 'react'

type IconProps = React.ComponentProps<'i'> & {
  type: string
  accessibilityLabel?: string
}

function MaterialIcon({
  type,
  className,
  accessibilityLabel,
  ...rest
}: IconProps) {
  const iconClassName = classNames('material-symbols', className)

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
