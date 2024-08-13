import { Form, FormSelectProps } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'
import FormGroup from '@/features/ui/components/bootstrap-5/form/form-group'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'

const meta: Meta<FormSelectProps> = {
  title: 'Shared / Components / Bootstrap 5 / Form / Select',
  component: Form.Select,
  parameters: {
    bootstrap5: true,
  },
}
export default meta

type Story = StoryObj<FormSelectProps>

export const Default: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText>Helper</FormText>
        </FormGroup>
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
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="info">Info</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="info">Info</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="info">Info</FormText>
        </FormGroup>
      </>
    )
  },
}

export const Error: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" isInvalid {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="error">Error</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select isInvalid {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="error">Error</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" isInvalid {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="error">Error</FormText>
        </FormGroup>
      </>
    )
  },
}

export const Warning: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="warning">Warning</FormText>
        </FormGroup>
      </>
    )
  },
}

export const Success: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option value="2">Two</option>
            <option value="3">Three</option>
          </Form.Select>
          <FormText type="success">Success</FormText>
        </FormGroup>
      </>
    )
  },
}
