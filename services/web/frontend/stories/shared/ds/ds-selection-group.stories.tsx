import { Meta, type StoryObj } from '@storybook/react'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'
import DSSelectionGroup from '@/shared/components/ds/ds-selection-group'
import DSSelectionGroupItem from '@/shared/components/ds/ds-selection-group-item'

type Story = StoryObj<typeof DSSelectionGroup>

export const SelectionGroupRadio: Story = {
  args: {
    legend: 'Select your favourite animal',
  },
  render: args => {
    return (
      <DSSelectionGroup {...args}>
        <DSSelectionGroupItem type="radio" name="animal" value="wombat">
          Wombat
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="radio" name="animal" value="capybara">
          Capybara
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="radio" name="animal" value="badger">
          Badger
        </DSSelectionGroupItem>
      </DSSelectionGroup>
    )
  },
}

export const SelectionGroupCheckbox: Story = {
  args: {
    legend: 'Which animals do you like?',
  },
  render: args => {
    return (
      <DSSelectionGroup {...args}>
        <DSSelectionGroupItem type="checkbox" name="vole">
          Vole
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="checkbox" name="spider">
          Spider
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="checkbox" name="wombat">
          Wombat
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="checkbox" name="capybara">
          Capybara
        </DSSelectionGroupItem>
        <DSSelectionGroupItem type="checkbox" name="badger">
          Badger
        </DSSelectionGroupItem>
      </DSSelectionGroup>
    )
  },
}

const meta: Meta<typeof DSSelectionGroup> = {
  title: 'Shared / DS Components',
  component: DSSelectionGroup,

  parameters: {
    controls: {
      include: ['legend'],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=6276-265&m=dev'
    ),
  },
}

export default meta
