import { Badge as BSBadge, BadgeProps as BSBadgeProps } from 'react-bootstrap-5'
import { MergeAndOverride } from '../../../../../../types/utils'

export type BadgeProps = MergeAndOverride<
  BSBadgeProps,
  {
    prepend?: React.ReactNode
    badgeContentRef?: React.RefObject<HTMLElement>
  }
>

function Badge({ prepend, children, badgeContentRef, ...rest }: BadgeProps) {
  return (
    <BSBadge {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content" ref={badgeContentRef}>
        {children}
      </span>
    </BSBadge>
  )
}

export default Badge
