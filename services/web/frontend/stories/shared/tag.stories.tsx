import TagIcon from '@/shared/components/tag-icon'
import OLTag from '@/shared/components/ol/ol-tag'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

const meta: Meta<typeof OLTag> = {
  title: 'Shared / Components / Tag',
  component: OLTag,
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

type Story = StoryObj<typeof OLTag>

export const Default: Story = {
  render: args => {
    return <OLTag {...args} />
  },
}
Default.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-244790&m=dev'
)

export const Prepend: Story = {
  render: args => {
    return <OLTag prepend={<TagIcon />} {...args} />
  },
}
Prepend.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-245386&m=dev'
)

export const Removable: Story = {
  render: args => {
    return (
      <OLTag
        prepend={<TagIcon />}
        closeBtnProps={{
          onClick: () => alert('Close triggered!'),
        }}
        {...args}
      />
    )
  },
}
Removable.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-238534&m=dev'
)

export const InteractiveRemovable: Story = {
  render: args => {
    return (
      <OLTag
        prepend={<TagIcon />}
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
