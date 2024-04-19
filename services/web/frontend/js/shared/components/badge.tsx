import classnames from 'classnames'
import { MergeAndOverride } from '../../../../types/utils'
import BadgeWrapper from '@/features/ui/components/bootstrap-5/wrappers/badge-wrapper'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    closeBtnProps?: React.ComponentProps<'button'>
    className?: string
    bsStyle?: NonNullable<
      React.ComponentProps<typeof BadgeWrapper>['bs3Props']
    >['bsStyle']
  }
>

function Badge({
  prepend,
  children,
  closeBtnProps,
  bsStyle,
  className,
  ...rest
}: BadgeProps) {
  const classNames =
    bsStyle === null
      ? className
      : classnames('label', `label-${bsStyle}`, className)

  return (
    <span className={classNames} {...rest}>
      {prepend && <span className="badge-bs3-prepend">{prepend}</span>}
      {children}
      {closeBtnProps && (
        <button type="button" className="badge-bs3-close" {...closeBtnProps}>
          <span aria-hidden="true">&times;</span>
        </button>
      )}
    </span>
  )
}

export default Badge
