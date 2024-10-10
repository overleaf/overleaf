import BS3Badge from '@/shared/components/badge'
import Icon from '@/shared/components/icon'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof BS3Badge> = {
  title: 'Shared / Components / Badge / Bootstrap 3',
  component: BS3Badge,
  parameters: {
    bootstrap5: false,
  },
  args: {
    children: 'Badge',
  },
  argTypes: {
    prepend: {
      table: {
        disable: true,
      },
    },
    bsStyle: {
      options: ['info', 'primary', 'warning', 'danger'],
      control: { type: 'radio' },
    },
    className: {
      table: {
        disable: true,
      },
    },
  },
}
export default meta

type Story = StoryObj<typeof BS3Badge>

export const BadgeDefault: Story = {
  render: args => {
    return (
      <div className="small">
        <BS3Badge {...args} />
      </div>
    )
  },
}
BadgeDefault.args = {
  bsStyle: meta.argTypes!.bsStyle!.options![0],
}

export const BadgePrepend: Story = {
  render: args => {
    return (
      <div className="small">
        <BS3Badge prepend={<Icon type="star" fw />} {...args} />
      </div>
    )
  },
}
BadgePrepend.args = {
  bsStyle: meta.argTypes!.bsStyle!.options![0],
}
