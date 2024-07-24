import { Label } from 'react-bootstrap'
import classnames from 'classnames'
import { MergeAndOverride } from '../../../../types/utils'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    className?: string
    bsStyle?: React.ComponentProps<typeof Label>['bsStyle'] | null
  }
>

function Badge({ prepend, children, bsStyle, className, ...rest }: BadgeProps) {
  const classNames =
    bsStyle === null
      ? className
      : classnames('label', `label-${bsStyle}`, className)

  return (
    <span className={classNames} {...rest}>
      {prepend && <span className="badge-tag-bs3-prepend">{prepend}</span>}
      <span className="badge-tag-bs3-content">{children}</span>
    </span>
  )
}

export default Badge
