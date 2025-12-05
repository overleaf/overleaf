import type { Meta, StoryObj } from '@storybook/react'
import DSFormCheckbox from '@/shared/components/ds/ds-form-checkbox'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<typeof DSFormCheckbox> = {
  title: 'Shared / DS Components / Form',
  component: DSFormCheckbox,
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
}
export default meta

type Story = StoryObj<typeof DSFormCheckbox>

export const Checkbox: Story = {
  args: {
    id: 'id-1',
    label: 'Label',
    disabled: false,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=6135-5430&m=dev'
  ),
}
