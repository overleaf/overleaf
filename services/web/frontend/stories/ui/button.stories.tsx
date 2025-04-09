import Button from '@/features/ui/components/bootstrap-5/button'
import { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof Button>

export const NewButton = (args: Args) => {
  return <Button {...args} />
}

export const ButtonWithLeadingIcon = (args: Args) => {
  return <Button leadingIcon="add" {...args} />
}

export const ButtonWithTrailingIcon = (args: Args) => {
  return <Button trailingIcon="add" {...args} />
}

export const ButtonWithIcons = (args: Args) => {
  return <Button trailingIcon="add" leadingIcon="add" {...args} />
}

const meta: Meta<typeof Button> = {
  title: 'Shared / Components / Button',
  component: Button,
  args: {
    children: 'A Button',
    disabled: false,
    isLoading: false,
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['small', 'default', 'large'],
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
      ],
    },
  },
}

export default meta
