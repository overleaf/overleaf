import classNames from 'classnames'

type IconProps = {
  type: string
  spin?: boolean
  fw?: boolean
  modifier?: string
  className?: string
  accessibilityLabel?: string
}

function Icon({
  type,
  spin,
  fw,
  modifier,
  className = '',
  accessibilityLabel,
}: IconProps) {
  const iconClassName = classNames(
    'fa',
    `fa-${type}`,
    {
      'fa-spin': spin,
      'fa-fw': fw,
      [`fa-${modifier}`]: modifier,
    },
    className
  )

  return (
    <>
      <i className={iconClassName} aria-hidden="true" />
      {accessibilityLabel && (
        <span className="sr-only">{accessibilityLabel}</span>
      )}
    </>
  )
}

export default Icon
