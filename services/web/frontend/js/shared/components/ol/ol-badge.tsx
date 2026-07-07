import { Badge as BSBadge, BadgeProps as BSBadgeProps } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../../types/utils'

export type OLBadgeProps = MergeAndOverride<
  BSBadgeProps,
  {
    prepend?: React.ReactNode
    badgeContentRef?: React.RefObject<HTMLElement>
  }
>

function OLBadge(props: OLBadgeProps) {
  let { bg, text, prepend, children, badgeContentRef, ...rest } = props

  // For warning badges, use a light background by default. We still want the
  // Bootstrap warning colour to be dark for text though, so make an
  // adjustment here
  if (bg === 'warning') {
    bg = 'warning-light-bg'
    text = 'warning'
  }

  return (
    <BSBadge bg={bg} text={text} {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content" ref={badgeContentRef}>
        {children}
      </span>
    </BSBadge>
  )
}

export default OLBadge
