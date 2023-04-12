import classnames from 'classnames'
import { MergeAndOverride } from '../../../../types/utils'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    className?: string
    showCloseButton?: boolean
    onClose?: (e: React.MouseEvent<HTMLButtonElement>) => void
    closeBtnProps?: React.ComponentProps<'button'>
  }
>

function Badge({
  prepend,
  children,
  className,
  showCloseButton = false,
  onClose,
  closeBtnProps,
  ...rest
}: BadgeProps) {
  return (
    <span className={classnames('badge-new', className)} {...rest}>
      {prepend}
      <span className="badge-new-comment">{children}</span>
      {showCloseButton && (
        <button
          type="button"
          className="badge-new-close"
          onClick={onClose}
          {...closeBtnProps}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}
    </span>
  )
}

export default Badge
