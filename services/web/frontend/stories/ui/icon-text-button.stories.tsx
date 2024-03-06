import IconTextButton from '@/features/ui/components/bootstrap-5/icon-text-button'
import { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof IconTextButton>

export const IconText = (args: Args) => {
  return <IconTextButton {...args} />
}

const meta: Meta<typeof IconTextButton> = {
  title: 'Shared / Components / Bootstrap 5 / IconTextButton',
  component: IconTextButton,
  args: {
    children: 'IconTextButton',
    disabled: false,
    isLoading: false,
    leadingIcon: 'add',
    trailingIcon: 'expand_more',
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
      ],
    },
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
