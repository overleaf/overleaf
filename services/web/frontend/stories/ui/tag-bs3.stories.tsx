import OLTagIcon from '@/features/ui/components/ol/icons/ol-tag-icon'
import BS3Tag from '@/shared/components/tag'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof BS3Tag> = {
  title: 'Shared / Components / Tag / Bootstrap 3',
  component: BS3Tag,
  parameters: {
    bootstrap5: false,
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

type Story = StoryObj<typeof BS3Tag>

export const TagDefault: Story = {
  render: args => {
    return (
      <div className="small">
        <BS3Tag {...args} />
      </div>
    )
  },
}

export const TagPrepend: Story = {
  render: args => {
    return (
      <div className="small">
        <BS3Tag prepend={<OLTagIcon />} {...args} />
      </div>
    )
  },
}

export const TagWithCloseButton: Story = {
  render: args => {
    return (
      <div className="small">
        <BS3Tag
          prepend={<OLTagIcon />}
          closeBtnProps={{
            onClick: () => alert('Close triggered!'),
          }}
          {...args}
        />
      </div>
    )
  },
}
