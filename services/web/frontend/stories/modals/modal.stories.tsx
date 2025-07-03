import Button from '@/features/ui/components/bootstrap-5/button'
import type { Meta, StoryObj } from '@storybook/react'
import OLModal, {
  OLModalHeader,
  OLModalBody,
  OLModalFooter,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

type Story = StoryObj<typeof OLModal>

export const Default: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Heading</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            Lorem ipsum dolor sit lorem a amet, consectetur adipiscing elit, sed
            do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
            enim ad minim veniam.
          </p>
        </OLModalBody>
        <OLModalFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="primary">Primary</Button>
        </OLModalFooter>
      </OLModal>
    )
  },
}

export const ModalWithAcknowledgment: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Acknowledgment</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            System requires an acknowledgment from the user. Usually contains
            only one primary button.
          </p>
        </OLModalBody>
        <OLModalFooter>
          <Button variant="primary">Accept</Button>
        </OLModalFooter>
      </OLModal>
    )
  },
}

export const ModalWithSecondary: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Heading</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            Lorem ipsum dolor sit lorem a amet, consectetur adipiscing elit, sed
            do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
            enim ad minim veniam.
          </p>
        </OLModalBody>
        <OLModalFooter>
          <Button variant="secondary">Cancel</Button>
        </OLModalFooter>
      </OLModal>
    )
  },
}

export const ModalWithTertiary: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Heading</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>Used for destructive or irreversible actions.</p>
        </OLModalBody>
        <OLModalFooter>
          <Button variant="secondary">Third</Button>
          <Button variant="secondary" className="ms-auto">
            Cancel
          </Button>
          <Button variant="primary">Primary</Button>
        </OLModalFooter>
      </OLModal>
    )
  },
}

export const ModalInformative: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Informative</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            Presents information for the user to be aware of and doesn’t require
            any action.
          </p>
        </OLModalBody>
      </OLModal>
    )
  },
}

export const ModalDanger: Story = {
  render: args => {
    return (
      <OLModal show {...args}>
        <OLModalHeader closeButton>
          <OLModalTitle>Danger</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            Lorem ipsum dolor sit lorem a amet, consectetur adipiscing elit, sed
            do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
            enim ad minim veniam.
          </p>
        </OLModalBody>
        <OLModalFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Delete</Button>
        </OLModalFooter>
      </OLModal>
    )
  },
}

const meta: Meta<typeof OLModal> = {
  title: 'Shared / Components / Modal',
  component: OLModal,
  argTypes: {
    size: {
      control: 'radio',
      options: ['lg', 'md', 'sm'],
    },
  },
}

export default meta
