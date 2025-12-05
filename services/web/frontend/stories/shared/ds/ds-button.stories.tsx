import { Meta } from '@storybook/react'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'
import DSButton from '@/shared/components/ds/ds-button'

type Args = React.ComponentProps<typeof DSButton>

export const Button = (args: Args) => {
  return <DSButton {...args} />
}

const meta: Meta<typeof DSButton> = {
  title: 'Shared / DS Components',
  component: DSButton,
  args: {
    children: 'Button',
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['lg', 'md', 'sm'],
    },
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'tertiary', 'danger'],
    },
  },
  parameters: {
    controls: {
      include: ['children', 'disabled', 'isLoading', 'size', 'variant'],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=4565-2932&m=dev'
    ),
  },
}

export default meta
