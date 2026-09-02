import type { Meta } from '@storybook/react-webpack5'
import {
  DisconnectedIndicatorContent,
  OfflineIndicatorContent,
} from '@/features/ide-react/components/toolbar/offline-indicator'

const wrapperStyle = {
  backgroundColor: 'var(--redesign-toolbar-background)',
  padding: '8px 12px',
  display: 'inline-flex',
}

export const Default = () => (
  <div style={wrapperStyle}>
    <OfflineIndicatorContent />
  </div>
)

export const Disconnected = () => (
  <div style={wrapperStyle}>
    <DisconnectedIndicatorContent />
  </div>
)

const meta: Meta = {
  title: 'Editor / Offline Indicator',
  component: OfflineIndicatorContent,
}

export default meta
