import React, { useEffect } from 'react'
import type { ConnectionStatus } from './types'
import { useSocketManager } from './use-socket-manager'
import {
  ActionButton,
  ConnectionBadge,
  DiagnosticItem,
  ErrorAlert,
} from './diagnostic-component'
import { Col, Container, Row } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import { CopyToClipboard } from '@/shared/components/copy-to-clipboard'

type NetworkInformation = {
  downlink: number
  effectiveType: string
  rtt: number
  saveData: boolean
  type: string
}

const navigatorInfo = (): string[] => {
  if (!('connection' in navigator)) {
    return ['Network Information API not supported']
  }

  const connection = navigator.connection as NetworkInformation

  return [
    `Downlink: ${connection.downlink} Mbps`,
    `Effective Type: ${connection.effectiveType}`,
    `Round Trip Time: ${connection.rtt} ms`,
    `Save Data: ${connection.saveData ? 'Enabled' : 'Disabled'}`,
    `Platform: ${navigator.platform}`,
    // @ts-ignore
    `Device Memory: ${navigator.deviceMemory}`,
    `Hardware Concurrency: ${navigator.hardwareConcurrency}`,
  ]
}

const useCurrentTime = () => {
  const [, setTime] = React.useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
}

type DiagnosticProps = {
  icon: string
  label: string
  text: string[]
  type?: 'success' | 'danger'
}

export const SocketDiagnostics = () => {
  const {
    socketState,
    debugInfo,
    disconnectSocket,
    forceReconnect,
    socket,
    autoping,
    setAutoping,
  } = useSocketManager()
  useCurrentTime()

  const now = new Date()

  const getConnectionState = (): ConnectionStatus => {
    if (socketState.connected) return 'connected'
    if (socketState.connecting) return 'connecting'
    return 'disconnected'
  }

  const lastReceivedS = debugInfo.lastReceived
    ? Math.round((now.getTime() - debugInfo.lastReceived) / 1000)
    : null

  const isLate =
    !!debugInfo.unansweredSince &&
    now.getTime() - debugInfo.unansweredSince >= 3000

  const diagnosticProps: DiagnosticProps[] = [
    {
      icon: 'network_ping',
      label: 'Ping Count',
      text: [
        `${debugInfo.received} / ${debugInfo.sent}`,
        lastReceivedS !== null ? `Last received ${lastReceivedS}s ago` : null,
      ].filter(Boolean) as string[],
      type: isLate === null ? undefined : isLate ? 'danger' : 'success',
    },
    {
      icon: 'schedule',
      label: 'Latency',
      text: [
        debugInfo.latency
          ? `${debugInfo.latency} ms\nMax: ${debugInfo.maxLatency} ms`
          : '-',
      ],
      type: debugInfo.latency && debugInfo.latency < 450 ? 'success' : 'danger',
    },
    {
      icon: 'difference',
      label: 'Clock Delta',
      text: [
        debugInfo.clockDelta === null
          ? '-'
          : `${Math.round(debugInfo.clockDelta / 1000)}s`,
      ],
      type:
        debugInfo.clockDelta !== null && Math.abs(debugInfo.clockDelta) < 1500
          ? 'success'
          : 'danger',
    },
    {
      icon: 'signal_cellular_alt',
      label: 'Online',
      text: [debugInfo.onLine?.toString() ?? '-'],
      type: debugInfo.onLine ? 'success' : 'danger',
    },
    {
      icon: 'schedule',
      label: 'Current time',
      text: [now.toUTCString()],
    },
    {
      icon: 'hourglass',
      label: 'Connection time',
      text: [
        debugInfo.client?.connectedAt
          ? `${new Date(debugInfo.client.connectedAt).toUTCString()} (${Math.round(
              (Date.now() - debugInfo.client.connectedAt) / 1000
            )}s)`
          : '-',
      ],
    },
    {
      icon: 'local_shipping',
      label: 'Transport',
      text: [socket?.socket.transport?.name ?? '-'],
    },
    {
      icon: 'badge',
      label: 'Client Public ID',
      text: [debugInfo.client?.publicId ?? '-'],
    },
    {
      icon: 'pin',
      label: 'IP Address',
      text: [debugInfo.client?.remoteIp ?? '-'],
    },
    {
      icon: 'web',
      label: 'User agent',
      text: [debugInfo.client?.userAgent ?? '-'],
    },
    {
      icon: 'directions_boat',
      label: 'Navigator info',
      text: navigatorInfo(),
    },
  ]

  const diagnosticItems = diagnosticProps.map(item => (
    <DiagnosticItem
      key={item.label}
      icon={item.icon}
      label={item.label}
      value={item.text.map((t, i) => (
        <div key={i}>{t}</div>
      ))}
      type={item.type}
    />
  ))
  const cutAtIndex = 7
  const leftItems = diagnosticItems.slice(0, cutAtIndex)
  const rightItems = diagnosticItems.slice(cutAtIndex)

  return (
    <Container>
      <h1>Socket Diagnostics</h1>
      <ConnectionBadge state={getConnectionState()} />
      <div className="d-flex flex-wrap gap-4 mt-3 align-items-center">
        <ActionButton
          label="Reconnect"
          icon="refresh"
          onClick={forceReconnect}
        />
        <ActionButton
          label="Disconnect"
          icon="close"
          onClick={disconnectSocket}
          disabled={!socketState.connected}
        />
        <OLFormCheckbox
          label="Auto ping"
          id="autoping"
          checked={autoping}
          onChange={e => setAutoping(e.target.checked)}
        />
      </div>

      {socketState.lastError && <ErrorAlert message={socketState.lastError} />}

      <div className="card p-4 mt-3">
        <div className="d-flex flex-wrap gap-4 row-gap-1 justify-content-between align-items-center">
          <h3 className="text-lg">
            <MaterialIcon type="speed" /> Connection Stats
          </h3>
          <div className="ms-auto">
            <CopyToClipboard
              content={diagnosticProps
                .map(item => [`${item.label}:`, ...item.text].join('\n'))
                .join('\n\n')}
              tooltipId="copy-debug-info"
              kind="text"
            />
          </div>
        </div>
        <Row>
          <Col md={6}>{leftItems}</Col>
          <Col md={6}>{rightItems}</Col>
        </Row>
      </div>
    </Container>
  )
}
