import classNames from 'classnames'

type IconOwnProps = {
  type: string
  accessibilityLabel?: string
}

type IconProps = IconOwnProps &
  Omit<React.ComponentProps<'i'>, keyof IconOwnProps>

function MaterialIcon({
  type,
  className,
  accessibilityLabel,
  ...rest
}: IconProps) {
  const iconClassName = classNames('material-symbols-rounded', className)

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
