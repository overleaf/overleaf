import { Form } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormText from '@/shared/components/ol/ol-form-text'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import MaterialIcon from '@/shared/components/material-icon'
import OLFormFeedback from '@/shared/components/ol/ol-form-feedback'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<React.ComponentProps<typeof OLFormControl>> = {
  title: 'Shared / Components / Form / Input',
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
          <OLFormControl defaultValue="Large input" size="lg" {...args} />
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl defaultValue="Regular input" {...args} />
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl defaultValue="Small input" size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-152419&m=dev'
)

export const Info: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
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
Info.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-152426&m=dev'
)

export const Error: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <OLFormControl size="lg" isInvalid {...args} />
          <OLFormFeedback type="invalid">Error</OLFormFeedback>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <OLFormControl isInvalid {...args} />
          <OLFormFeedback type="invalid">Error</OLFormFeedback>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <OLFormControl size="sm" isInvalid {...args} />
          <OLFormFeedback type="invalid">Error</OLFormFeedback>
        </OLFormGroup>
      </>
    )
  },
  args: {
    disabled: false,
  },
}
Error.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-166648&m=dev'
)

export const Warning: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <OLFormControl size="lg" {...args} />
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <OLFormControl {...args} />
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <OLFormControl size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-166648&m=dev'
)

export const Success: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <OLFormControl size="lg" {...args} />
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <OLFormControl {...args} />
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <OLFormControl size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-166648&m=dev'
)

export const WithIcons: Story = {
  render: args => {
    const handleClear = () => {
      alert('Clicked clear button')
    }

    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            type="text"
            placeholder="Search"
            prepend={<MaterialIcon type="search" />}
            append={
              <button
                type="button"
                className="form-control-search-clear-btn"
                onClick={handleClear}
              >
                <MaterialIcon type="clear" />
              </button>
            }
            size="lg"
            {...args}
          />
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            type="text"
            placeholder="Search"
            prepend={<MaterialIcon type="search" />}
            append={
              <button
                type="button"
                className="form-control-search-clear-btn"
                onClick={handleClear}
              >
                <MaterialIcon type="clear" />
              </button>
            }
            {...args}
          />
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <OLFormControl
            type="text"
            placeholder="Search"
            prepend={<MaterialIcon type="search" />}
            append={
              <button
                type="button"
                className="form-control-search-clear-btn"
                onClick={handleClear}
              >
                <MaterialIcon type="clear" />
              </button>
            }
            size="sm"
            {...args}
          />
        </OLFormGroup>
        <br />
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Disabled state</Form.Label>
          <OLFormControl
            type="text"
            placeholder="Search"
            prepend={<MaterialIcon type="search" />}
            append={
              <button
                type="button"
                className="form-control-search-clear-btn"
                onClick={handleClear}
                disabled
              >
                <MaterialIcon type="clear" />
              </button>
            }
            disabled
            {...args}
          />
        </OLFormGroup>
      </>
    )
  },
  args: {
    disabled: false,
  },
}
