import type { Meta, StoryObj } from '@storybook/react-webpack5'
import classnames from 'classnames'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'
import OLBadge from '@/shared/components/ol/ol-badge'
import MaterialIcon from '@/shared/components/material-icon'

const meta: Meta<typeof OLBadge> = {
  title: 'Shared / Components / Badge',
  component: OLBadge,
  args: {
    children: 'Badge',
  },
  argTypes: {
    bg: {
      options: ['light', 'info', 'primary', 'warning', 'danger'],
      control: { type: 'radio' },
    },
    prepend: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
  },
}
export default meta

type Story = StoryObj<typeof OLBadge>

export const BadgeDefault: Story = {
  args: {
    bg: meta.argTypes!.bg!.options![0],
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3458-9502&m=dev'
  ),
  render: args => (
    <OLBadge
      className={classnames({ 'text-dark': args.bg === 'light' })}
      {...args}
    />
  ),
}

export const BadgePrepend: Story = {
  args: {
    bg: meta.argTypes!.bg!.options![0],
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3458-11319&m=dev'
  ),
  render: args => {
    return (
      <OLBadge
        className={classnames({ 'text-dark': args.bg === 'light' })}
        prepend={<MaterialIcon type="star" />}
        {...args}
      />
    )
  },
}
