import { Form } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'

const meta: Meta<(typeof Form)['Control']> = {
  title: 'Shared / Components / Bootstrap 5 / Form / Input',
  component: Form.Control,
  parameters: {
    bootstrap5: true,
  },
}
export default meta

type Story = StoryObj<(typeof Form)['Control']>

export const Default: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Control defaultValue="Large input" size="lg" {...args} />
          <FormText>Helper</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Control defaultValue="Regular input" {...args} />
          <FormText>Helper</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Control defaultValue="Small input" size="sm" {...args} />
          <FormText>Helper</FormText>
        </Form.Group>
      </>
    )
  },
}
Default.args = {
  disabled: false,
}

export const Info: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText isInfo>Info</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText isInfo>Info</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <FormText isInfo>Info</FormText>
        </Form.Group>
      </>
    )
  },
}

export const Error: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            isInvalid
            {...args}
          />
          <FormText isError>Error</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Regular input"
            isInvalid
            {...args}
          />
          <FormText isError>Error</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            isInvalid
            {...args}
          />
          <FormText isError>Error</FormText>
        </Form.Group>
      </>
    )
  },
}

export const Warning: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText isWarning>Warning</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText isWarning>Warning</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <FormText isWarning>Warning</FormText>
        </Form.Group>
      </>
    )
  },
}

export const Success: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText isSuccess>Success</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText isSuccess>Success</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Control
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <FormText isSuccess>Success</FormText>
        </Form.Group>
      </>
    )
  },
}
