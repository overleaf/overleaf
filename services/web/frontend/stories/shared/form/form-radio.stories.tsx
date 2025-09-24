import { Form } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<(typeof Form)['Check']> = {
  title: 'Shared / Components / Form',
  component: Form.Check,
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
}
export default meta

type Story = StoryObj<(typeof Form)['Check']>

export const Radio: Story = {
  args: {
    id: 'id-1',
    type: 'radio',
    label: 'Label',
    disabled: false,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3495-259211&m=dev'
  ),
}

export const RadioChecked: Story = {
  args: {
    id: 'id-1',
    type: 'radio',
    label: 'Label',
    disabled: false,
    defaultChecked: true,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3495-259218&m=dev'
  ),
}
