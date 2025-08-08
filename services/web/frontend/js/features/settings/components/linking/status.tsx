import { ReactNode } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import OLSpinner from '@/shared/components/ol/ol-spinner'

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
        <MaterialIcon
          type="check_circle"
          className="settings-widget-status-icon status-success"
        />
      )
    case 'error':
      return (
        <MaterialIcon
          type="cancel"
          className="settings-widget-status-icon status-error"
        />
      )
    case 'pending':
      return <OLSpinner size="sm" />
    default:
      return null
  }
}
