import { ReactNode } from 'react'
import Icon from '../../../../shared/components/icon'

type Status = 'pending' | 'success' | 'error'

type LinkingStatusProps = {
  status: Status
  description: string | ReactNode
}

export default function LinkingStatus({
  status,
  description,
}: LinkingStatusProps) {
  return (
    <span>
      <StatusIcon status={status} />
      <span className="small"> {description}</span>
    </span>
  )
}

type StatusIconProps = {
  status: Status
}

function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'success':
      return (
        <Icon
          type="check-circle"
          fw
          className="settings-widget-status-icon status-success"
        />
      )
    case 'error':
      return (
        <Icon
          type="times-circle"
          fw
          className="settings-widget-status-icon status-error"
        />
      )
    case 'pending':
      return (
        <Icon
          type="circle"
          fw
          className="settings-widget-status-icon status-pending"
          spin
        />
      )
    default:
      return null
  }
}
