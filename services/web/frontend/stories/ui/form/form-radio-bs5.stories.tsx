import { Form } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<(typeof Form)['Check']> = {
  title: 'Shared / Components / Bootstrap 5 / Form',
  component: Form.Check,
  parameters: {
    bootstrap5: true,
  },
  argTypes: {
    id: {
      table: {
        disable: true,
      },
    },
    label: {
      table: {
        disable: true,
      },
    },
    type: {
      table: {
        disable: true,
      },
    },
    defaultChecked: {
      table: {
        disable: true,
      },
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
}

export const RadioChecked: Story = {
  args: {
    id: 'id-1',
    type: 'radio',
    label: 'Label',
    disabled: false,
    defaultChecked: true,
  },
}
