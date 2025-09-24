import { Meta } from '@storybook/react'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'
import OLButton from '@/shared/components/ol/ol-button'

type Args = React.ComponentProps<typeof OLButton>

export const NewButton = (args: Args) => {
  return <OLButton {...args} />
}

export const ButtonWithLeadingIcon = (args: Args) => {
  return <OLButton leadingIcon="add" {...args} />
}

export const ButtonWithTrailingIcon = (args: Args) => {
  return <OLButton trailingIcon="add" {...args} />
}

export const ButtonWithIcons = (args: Args) => {
  return <OLButton trailingIcon="add" leadingIcon="add" {...args} />
}

const meta: Meta<typeof OLButton> = {
  title: 'Shared / Components / Button',
  component: OLButton,
  args: {
    children: 'Button',
    disabled: false,
    isLoading: false,
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['lg', 'md', 'sm'],
    },
    variant: {
      control: 'radio',
      options: [
        'primary',
        'secondary',
        'ghost',
        'danger',
        'danger-ghost',
        'premium',
        'premium-secondary',
        'link',
      ],
    },
  },
  parameters: {
    controls: {
      include: ['children', 'disabled', 'isLoading', 'size', 'variant'],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3458-22412&m=dev'
    ),
  },
}

export default meta
