import type { Meta, StoryObj } from '@storybook/react'
import DSFormRadio from '@/shared/components/ds/ds-form-radio'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<typeof DSFormRadio> = {
  title: 'Shared / DS Components / Form',
  component: DSFormRadio,
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
}
export default meta

type Story = StoryObj<typeof DSFormRadio>

export const Radio: Story = {
  args: {
    id: 'id-1',
    label: 'Label',
    disabled: false,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=6135-5510&m=dev'
  ),
}
