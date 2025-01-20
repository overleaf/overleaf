import { Form } from 'react-bootstrap-5'
import type { Meta, StoryObj } from '@storybook/react'
import FormGroup from '@/features/ui/components/bootstrap-5/form/form-group'
import FormText from '@/features/ui/components/bootstrap-5/form/form-text'
import FormControl from '@/features/ui/components/bootstrap-5/form/form-control'
import MaterialIcon from '@/shared/components/material-icon'
import FormFeedback from '@/features/ui/components/bootstrap-5/form/form-feedback'

const meta: Meta<React.ComponentProps<typeof FormControl>> = {
  title: 'Shared / Components / Bootstrap 5 / Form / Input',
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
}

export const Error: Story = {
  render: args => {
    return (
      <>
        <FormGroup controlId="id-1">
          <Form.Label>Label</Form.Label>
          <FormControl
            placeholder="Placeholder"
            defaultValue="Large input"
            size="lg"
            isInvalid
            {...args}
          />
          <FormFeedback type="invalid">Error</FormFeedback>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-2">
          <Form.Label>Label</Form.Label>
          <FormControl
            placeholder="Placeholder"
            defaultValue="Regular input"
            isInvalid
            {...args}
          />
          <FormFeedback type="invalid">Error</FormFeedback>
        </FormGroup>
        <hr />
        <FormGroup controlId="id-3">
          <Form.Label>Label</Form.Label>
          <FormControl
            placeholder="Placeholder"
            defaultValue="Small input"
            size="sm"
            isInvalid
            {...args}
          />
          <FormFeedback type="invalid">Error</FormFeedback>
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
}
