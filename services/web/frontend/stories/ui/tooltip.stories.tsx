import { Button } from 'react-bootstrap-5'
import Tooltip from '@/features/ui/components/bootstrap-5/tooltip'
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
        <Tooltip
          key={placement}
          id={`tooltip-${placement}`}
          description={`Tooltip on ${placement}`}
          overlayProps={{ placement }}
        >
          <Button variant="secondary">Tooltip on {placement}</Button>
        </Tooltip>
      ))}
    </div>
  )
}

const meta: Meta<typeof Tooltip> = {
  title: 'Shared / Components / Bootstrap 5 / Tooltip',
  component: Tooltip,
  parameters: {
    bootstrap5: true,
  },
}

export default meta
