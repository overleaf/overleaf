import Badge from '@/features/ui/components/bootstrap-5/badge'
import MaterialIcon from '@/shared/components/material-icon'
import type { Meta, StoryObj } from '@storybook/react'
import classnames from 'classnames'

const meta: Meta<typeof Badge> = {
  title: 'Shared / Components / Badge',
  component: Badge,
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

type Story = StoryObj<typeof Badge>

export const BadgeDefault: Story = {
  render: args => {
    return (
      <Badge
        className={classnames({ 'text-dark': args.bg === 'light' })}
        {...args}
      />
    )
  },
}
BadgeDefault.args = {
  bg: meta.argTypes!.bg!.options![0],
}

export const BadgePrepend: Story = {
  render: args => {
    return (
      <Badge
        className={classnames({ 'text-dark': args.bg === 'light' })}
        prepend={<MaterialIcon type="star" />}
        {...args}
      />
    )
  },
}
BadgePrepend.args = {
  bg: meta.argTypes!.bg!.options![0],
}
