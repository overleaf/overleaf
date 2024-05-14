import { Form } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'

const meta: Meta<(typeof Form)['Select']> = {
  title: 'Shared / Components / Bootstrap 5 / Form / Select',
  component: Form.Select,
  parameters: {
    bootstrap5: true,
  },
}
export default meta

type Story = StoryObj<(typeof Form)['Select']>

export const Default: Story = {
  render: args => {
    return (
      <>
        <Form.Group controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText>Helper</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText>Helper</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
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
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isInfo>Info</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isInfo>Info</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
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
          <Form.Select size="lg" isInvalid {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isError>Error</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select isInvalid {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isError>Error</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" isInvalid {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
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
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isWarning>Warning</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isWarning>Warning</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
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
          <Form.Select size="lg" isSuccess {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isSuccess>Success</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select isSuccess {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isSuccess>Success</FormText>
        </Form.Group>
        <hr />
        <Form.Group controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" isSuccess {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText isSuccess>Success</FormText>
        </Form.Group>
      </>
    )
  },
}
