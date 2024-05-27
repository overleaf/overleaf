import { Badge as BSBadge } from 'react-bootstrap-5'
import { MergeAndOverride } from '../../../../../../types/utils'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<typeof BSBadge>,
  {
    prepend?: React.ReactNode
  }
>

function Badge({ prepend, children, closeBtnProps, ...rest }: BadgeProps) {
  return (
    <BSBadge {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content">{children}</span>
    </BSBadge>
  )
}

export default Badge
