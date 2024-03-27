import IconButton from '@/features/ui/components/bootstrap-5/icon-button'
import type { Meta } from '@storybook/react'
import { useTranslation } from 'react-i18next'

type Args = React.ComponentProps<typeof IconButton>

export const Icon = (args: Args) => {
  const { t } = useTranslation()

  return <IconButton accessibilityLabel={t('add')} disabled {...args} />
}

const meta: Meta<typeof IconButton> = {
  title: 'Shared / Components / Bootstrap 5 / IconButton',
  component: IconButton,
  args: {
    disabled: false,
    icon: 'add',
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
      ],
    },
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
