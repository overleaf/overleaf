import classNames from 'classnames'
import { bsVersion } from '@/features/utils/bootstrap-5'

type IconOwnProps = {
  type: string
  spin?: boolean
  fw?: boolean
  modifier?: string
  accessibilityLabel?: string
}

export type IconProps = IconOwnProps &
  Omit<React.ComponentProps<'i'>, keyof IconOwnProps>

function Icon({
  type,
  spin,
  fw,
  modifier,
  className = '',
  accessibilityLabel,
  ...rest
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
      <i className={iconClassName} aria-hidden="true" {...rest} />
      {accessibilityLabel && (
        <span className={bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })}>
          {accessibilityLabel}
        </span>
      )}
    </>
  )
}

export default Icon
