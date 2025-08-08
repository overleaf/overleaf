import React from 'react'
import classnames from 'classnames'
import type { ConnectionStatus } from './types'
import { Badge, Button } from 'react-bootstrap'
import OLNotification from '@/shared/components/ol/ol-notification'
import MaterialIcon from '@/shared/components/material-icon'

const variants = {
  connected: 'success',
  connecting: 'warning',
  disconnected: 'danger',
}

export const ConnectionBadge = ({ state }: { state: ConnectionStatus }) => (
  <Badge className="px-2 py-1" bg={variants[state]}>
    {state}
  </Badge>
)

export const DiagnosticItem = ({
  icon,
  label,
  value,
  type,
}: {
  icon: string
  label: string
  value: React.ReactNode
  type?: 'success' | 'danger'
}) => (
  <div
    className={classnames(
      'py-2',
      type === 'success' && 'text-success',
      type === 'danger' && 'text-danger'
    )}
  >
    <div className="d-flex gap-2 fw-bold align-items-center">
      <MaterialIcon type={icon} />
      <span>{label}</span>
    </div>
    <div>{value}</div>
  </div>
)

export function ErrorAlert({ message }: { message: string }) {
  return <OLNotification type="error" content={message} className="mt-3" />
}

export function ActionButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="d-flex align-items-center"
    >
      <MaterialIcon className="me-2" type={icon} />
      <span>{label}</span>
    </Button>
  )
}
