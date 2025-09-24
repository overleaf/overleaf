import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { Meta } from '@storybook/react'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

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
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-237285&m=dev'
  ),
}

export default meta
