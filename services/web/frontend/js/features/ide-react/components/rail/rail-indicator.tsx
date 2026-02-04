import OLBadge from '@/shared/components/ol/ol-badge'

type RailIndicatorProps = {
  type: 'danger' | 'warning' | 'info'
  count: number
}

function formatNumber(num: number) {
  if (num > 99) {
    return '99+'
  }
  return Math.floor(num).toString()
}

export const RailIndicator = ({ count, type }: RailIndicatorProps) => {
  return <OLBadge bg={type}>{formatNumber(count)}</OLBadge>
}
