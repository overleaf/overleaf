import classnames from 'classnames'
import { MergeAndOverride } from '../../../../types/utils'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    className?: string
    closeButton?: boolean
    onClose?: (e: React.MouseEvent<HTMLButtonElement>) => void
    closeBtnProps?: React.ComponentProps<'button'>
    size?: 'sm'
  }
>

function Badge({
  prepend,
  children,
  className,
  closeButton = false,
  onClose,
  closeBtnProps,
  size,
  ...rest
}: BadgeProps) {
  return (
    <span className={classnames('badge-new', className)} {...rest}>
      {prepend}
      <span className="badge-new-comment">{children}</span>
      {closeButton && (
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
