import { Form } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormText from '@/shared/components/ol/ol-form-text'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<React.ComponentProps<typeof OLFormControl>> = {
  title: 'Shared / Components / Form / Textarea',
  component: OLFormControl,
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
}
export default meta

type Story = StoryObj<React.ComponentProps<typeof OLFormControl>>

export const Default: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl as="textarea" defaultValue="Regular input" {...args} />
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
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
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <OLFormText type="info">Info</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <OLFormText type="info">Info</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <OLFormText type="info">Info</OLFormText>
        </OLFormGroup>
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
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            isInvalid
            {...args}
          />
          <OLFormText type="error">Error</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            isInvalid
            {...args}
          />
          <OLFormText type="error">Error</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            isInvalid
            {...args}
          />
          <OLFormText type="error">Error</OLFormText>
        </OLFormGroup>
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
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
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
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            {...args}
          />
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Regular input"
            {...args}
          />
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            as="textarea"
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            {...args}
          />
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
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
