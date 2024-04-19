import { Badge as BSBadge } from 'react-bootstrap-5'
import { MergeAndOverride } from '../../../../../../types/utils'
import MaterialIcon from '@/shared/components/material-icon'

type BadgeProps = MergeAndOverride<
  React.ComponentProps<typeof BSBadge>,
  {
    prepend?: React.ReactNode
    closeBtnProps?: React.ComponentProps<'button'>
  }
>

function Badge({ prepend, children, closeBtnProps, ...rest }: BadgeProps) {
  return (
    <BSBadge {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      {children}
      {closeBtnProps && (
        <button type="button" className="badge-close" {...closeBtnProps}>
          <MaterialIcon className="badge-close-icon" type="close" />
        </button>
      )}
    </BSBadge>
  )
}

export default Badge
