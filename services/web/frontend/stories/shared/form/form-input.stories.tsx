import { Form } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react'
import FormGroup from '@/shared/components/form/form-group'
import FormText from '@/shared/components/form/form-text'
import FormControl from '@/shared/components/form/form-control'
import MaterialIcon from '@/shared/components/material-icon'
import FormFeedback from '@/shared/components/form/form-feedback'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'

const meta: Meta<React.ComponentProps<typeof FormControl>> = {
  title: 'Shared / Components / Form / Input',
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
          <FormControl defaultValue="Large input" size="lg" {...args} />
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl defaultValue="Regular input" {...args} />
          <FormText>Helper</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl defaultValue="Small input" size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-152419&m=dev'
)

export const Info: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <FormControl
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
Info.parameters = figmaDesignUrl(
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-152426&m=dev'
)

export const Error: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <FormControl size="lg" isInvalid {...args} />
          <FormFeedback type="invalid">Error</FormFeedback>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <FormControl isInvalid {...args} />
          <FormFeedback type="invalid">Error</FormFeedback>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <FormControl size="sm" isInvalid {...args} />
          <FormFeedback type="invalid">Error</FormFeedback>
        </FormGroup>
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
        <FormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <FormControl size="lg" {...args} />
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <FormControl {...args} />
          <FormText type="warning">Warning</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <FormControl size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-166648&m=dev'
)

export const Success: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Large input label</Form.Label>
          <FormControl size="lg" {...args} />
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Regular input label</Form.Label>
          <FormControl {...args} />
          <FormText type="success">Success</FormText>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Small input label</Form.Label>
          <FormControl size="sm" {...args} />
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-166648&m=dev'
)

export const WithIcons: Story = {
  render: args => {
    const handleClear = () => {
      alert('Clicked clear button')
    }

    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <FormControl
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
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
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
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
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
        </FormGroup>
        <br />
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Disabled state</Form.Label>
          <FormControl
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
        </FormGroup>
      </>
    )
  },
  args: {
    disabled: false,
  },
}
