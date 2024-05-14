import { useRef, useLayoutEffect } from 'react'
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
    defaultChecked: {
      table: {
        disable: true,
      },
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
}

export const CheckboxChecked: Story = {
  args: {
    id: 'id-1',
    label: 'Label',
    disabled: false,
    defaultChecked: true,
  },
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
