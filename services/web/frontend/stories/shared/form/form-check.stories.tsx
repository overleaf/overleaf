import { useRef, useLayoutEffect } from 'react'
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

export const Checkbox: Story = {
  args: {
    id: 'id-1',
    label: 'Label',
    disabled: false,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3494-247203&m=dev'
  ),
}

export const CheckboxChecked: Story = {
  args: {
    id: 'id-1',
    label: 'Label',
    disabled: false,
    defaultChecked: true,
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3495-249055&m=dev'
  ),
}

export const CheckboxIndeterminate = (args: Story['args']) => {
  const ref = useRef<HTMLInputElement>()

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = true
    }
  }, [])

  return <Form.Check ref={ref} {...args} />
}
CheckboxIndeterminate.args = {
  id: 'id-2',
  label: 'Label',
  disabled: false,
}
CheckboxIndeterminate.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3495-249055&m=dev'
)
