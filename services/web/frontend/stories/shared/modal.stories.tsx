import type { Meta, StoryObj } from '@storybook/react'
import { figmaDesignUrl } from './../../../.storybook/utils/figma-design-url'
import {
  OLModal,
  OLModalHeader,
  OLModalBody,
  OLModalFooter,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'

type Story = StoryObj<typeof OLModal>

export const Default: Story = {
  args: {
    title: 'Heading',
    children: (
      <p>
        Always use the modal actions in the footer and use descriptive words for
        them.
      </p>
    ),
    footer: (
      <>
        <OLButton variant="secondary">Cancel</OLButton>
        <OLButton variant="primary">Primary</OLButton>
      </>
    ),
  },
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?m=auto&node-id=3488-82657&m=dev'
  ),
}

export const Informative: Story = {
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?m=auto&node-id=3488-86576&m=dev'
  ),
  args: {
    title: 'Informative',
    children: (
      <p>
        Presents information for the user to be aware of and doesn’t require any
        action.
      </p>
    ),
  },
}

export const Acknowledgment: Story = {
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?m=auto&node-id=3488-86581&m=dev'
  ),
  args: {
    title: 'Acknowledgment',
    children: (
      <p>
        System requires an acknowledgment from the user. Usually contains only
        one primary button.
      </p>
    ),
    footer: <OLButton variant="primary">Accept</OLButton>,
  },
}

export const Danger: Story = {
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?m=auto&node-id=3488-86586&m=dev'
  ),
  args: {
    title: 'Danger',
    children: <p>Used for destructive or irreversible actions.</p>,
    footer: (
      <>
        <OLButton variant="secondary">Cancel</OLButton>
        <OLButton variant="danger">Delete</OLButton>
      </>
    ),
  },
}

const meta: Meta<typeof OLModal> = {
  title: 'Shared / Components / Modal',
  component: OLModal,
  parameters: {
    controls: {
      include: ['size', 'title'],
    },
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['lg', 'md', 'sm'],
    },
  },
  args: {
    show: true,
    size: 'sm',
    onHide: () => {},
  },
  render: ({ title, children, footer, ...args }) => (
    <OLModal {...args}>
      <OLModalHeader>
        <OLModalTitle>{title}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{children}</OLModalBody>
      {footer && <OLModalFooter>{footer}</OLModalFooter>}
    </OLModal>
  ),
}

export default meta
