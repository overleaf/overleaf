import { Badge as BSBadge, BadgeProps as BSBadgeProps } from 'react-bootstrap-5'
import { MergeAndOverride } from '../../../../../../types/utils'

type BadgeProps = MergeAndOverride<
  BSBadgeProps,
  {
    prepend?: React.ReactNode
  }
>

function Badge({ prepend, children, ...rest }: BadgeProps) {
  return (
    <BSBadge {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content">{children}</span>
    </BSBadge>
  )
}

export default Badge
