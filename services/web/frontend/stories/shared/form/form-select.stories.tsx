import { Form, FormSelectProps } from 'react-bootstrap'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormText from '@/shared/components/ol/ol-form-text'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'
import { themedDecorator } from '../../utils/themed-decorator'

const meta: Meta<FormSelectProps> = {
  title: 'Shared / Components / Form / Select',
  component: Form.Select,
  parameters: {
    controls: {
      include: ['disabled'],
    },
  },
  decorators: [themedDecorator],
}
export default meta

type Story = StoryObj<FormSelectProps>

export const Default: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-199797&m=dev'
)

export const OptionGroups: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <optgroup label="Group 1">
              <option value="1">One</option>
              <option disabled value="2">
                Two
              </option>
              <option value="3">Three</option>
            </optgroup>
            <optgroup label="Group 2">
              <option value="4">Four</option>
              <option disabled value="5">
                Five
              </option>
              <option value="6">Six</option>
            </optgroup>
          </Form.Select>
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <optgroup label="Group 1">
              <option value="1">One</option>
              <option disabled value="2">
                Two
              </option>
              <option value="3">Three</option>
            </optgroup>
            <optgroup label="Group 2">
              <option value="4">Four</option>
              <option disabled value="5">
                Five
              </option>
              <option value="6">Six</option>
            </optgroup>
          </Form.Select>
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Small select</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Select an option</option>
            <optgroup label="Group 1">
              <option value="1">One</option>
              <option disabled value="2">
                Two
              </option>
              <option value="3">Three</option>
            </optgroup>
            <optgroup label="Group 2">
              <option value="4">Four</option>
              <option disabled value="5">
                Five
              </option>
              <option value="6">Six</option>
            </optgroup>
          </Form.Select>
          <OLFormText>Helper</OLFormText>
        </OLFormGroup>
      </>
    )
  },
}
OptionGroups.args = {
  disabled: false,
}

export const Info: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="info">Info</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="info">Info</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
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
          <Form.Select size="lg" isInvalid {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="error">Error</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select isInvalid {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="error">Error</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" isInvalid {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-200123&m=dev'
)

export const Warning: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="warning">Warning</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-199800&m=dev'
)

export const Success: Story = {
  render: args => {
    return (
      <>
        <OLFormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <Form.Select size="lg" {...args}>
            <option>Large select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <Form.Select {...args}>
            <option>Regular select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
          <OLFormText type="success">Success</OLFormText>
        </OLFormGroup>
        <hr />
        <OLFormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <Form.Select size="sm" {...args}>
            <option>Small select</option>
            <option value="1">One</option>
            <option disabled value="2">
              Two
            </option>
            <option value="3">Three</option>
          </Form.Select>
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
  'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-199800&m=dev'
)
