import OLTagIcon from '@/features/ui/components/ol/icons/ol-tag-icon'
import Tag from '@/features/ui/components/bootstrap-5/tag'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Tag> = {
  title: 'Shared / Components / Tag / Bootstrap 5',
  component: Tag,
  parameters: {
    bootstrap5: true,
  },
  args: {
    children: 'Tag',
  },
  argTypes: {
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
    closeBtnProps: {
      table: {
        disable: true,
      },
    },
  },
}
export default meta

type Story = StoryObj<typeof Tag>

export const TagDefault: Story = {
  render: args => {
    return <Tag {...args} />
  },
}

export const TagPrepend: Story = {
  render: args => {
    return <Tag prepend={<OLTagIcon />} {...args} />
  },
}

export const TagWithCloseButton: Story = {
  render: args => {
    return (
      <Tag
        prepend={<OLTagIcon />}
        closeBtnProps={{
          onClick: () => alert('Close triggered!'),
        }}
        {...args}
      />
    )
  },
}

export const TagWithContentButtonAndCloseButton: Story = {
  render: args => {
    return (
      <Tag
        prepend={<OLTagIcon />}
        contentProps={{
          onClick: () => alert('Content button clicked!'),
        }}
        closeBtnProps={{
          onClick: () => alert('Close triggered!'),
        }}
        {...args}
      />
    )
  },
}
