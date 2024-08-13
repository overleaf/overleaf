import { Form } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'
import FormGroup from '@/features/ui/components/bootstrap-5/form/form-group'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'
import FormControl from '@/features/ui/components/bootstrap-5/form/form-control'

const meta: Meta<React.ComponentProps<typeof FormControl>> = {
  title: 'Shared / Components / Bootstrap 5 / Form / Textarea',
  component: FormControl,
  parameters: {
    bootstrap5: true,
  },
}
export default meta

type Story = StoryObj<React.ComponentProps<typeof FormControl>>

export const Default: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl as="textarea" defaultValue="Regular input" {...args} />
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
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
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText type="info">Info</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText type="info">Info</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
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
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            isInvalid
            {...args}
          />
          <FormText type="error">Error</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            isInvalid
            {...args}
          />
          <FormText type="error">Error</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            isInvalid
            {...args}
          />
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
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
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
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <FormText type="success">Success</FormText>
        </FormGroup>
      </>
    )
  },
}
