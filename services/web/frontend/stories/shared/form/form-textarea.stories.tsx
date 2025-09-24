import { Form } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react'
import FormGroup from '@/shared/components/form/form-group'
import FormText from '@/shared/components/form/form-text'
import FormControl from '@/shared/components/form/form-control'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<React.ComponentProps<typeof FormControl>> = {
  title: 'Shared / Components / Form / Textarea',
  component: FormControl,
  parameters: {
    controls: {
      include: ['disabled'],
    },
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
Default.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-176397&m=dev'
)

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
  args: {
    disabled: false,
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
  args: {
    disabled: false,
  },
}
Error.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-176403&m=dev'
)

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
  args: {
    disabled: false,
  },
}
Warning.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-176403&m=dev'
)

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
  args: {
    disabled: false,
  },
}
Success.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-176403&m=dev'
)
