import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { Meta } from '@storybook/react'

export const Tooltips = () => {
  const placements = ['top', 'right', 'bottom', 'left'] as const

  return (
    <div
      style={{
        width: '200px',
        display: 'flex',
        flexDirection: 'column',
        margin: '0 auto',
        padding: '35px 0',
        gap: '35px',
      }}
    >
      {placements.map(placement => (
        <OLTooltip
          key={placement}
          id={`tooltip-${placement}`}
          description={`Tooltip on ${placement}`}
          overlayProps={{ placement }}
        >
          <OLButton variant="secondary">Tooltip on {placement}</OLButton>
        </OLTooltip>
      ))}
    </div>
  )
}

const meta: Meta<typeof OLTooltip> = {
  title: 'Shared / Components / Tooltip',
  component: OLTooltip,
}

export default meta
