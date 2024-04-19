import Badge from '@/shared/components/badge'
import Icon from '@/shared/components/icon'
import type { Meta, StoryObj } from '@storybook/react'
import classnames from 'classnames'

const meta: Meta<typeof Badge> = {
  title: 'Shared / Components / Badge / Bootstrap 3',
  component: Badge,
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
      options: [null, 'primary', 'warning', 'danger'],
      control: { type: 'radio' },
    },
    className: {
      table: {
        disable: true,
      },
    },
    closeBtnProps: {
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
        className={classnames({ 'badge-bs3': args.bsStyle === null })}
        {...args}
      />
    )
  },
}
BadgeDefault.args = {
  bsStyle: null,
}

export const BadgePrepend: Story = {
  render: args => {
    return (
      <Badge
        className={classnames({ 'badge-bs3': args.bsStyle === null })}
        prepend={<Icon type="tag" fw />}
        {...args}
      />
    )
  },
}
BadgePrepend.args = {
  bsStyle: null,
}

export const BadgeWithCloseButton: Story = {
  render: args => {
    return (
      <Badge
        className={classnames({ 'badge-bs3': args.bsStyle === null })}
        prepend={<Icon type="tag" fw />}
        closeBtnProps={{
          onClick: () => alert('Close triggered!'),
        }}
        {...args}
      />
    )
  },
}
BadgeWithCloseButton.args = {
  bsStyle: null,
}
BadgeWithCloseButton.argTypes = {
  bsStyle: {
    table: {
      disable: true,
    },
  },
}
