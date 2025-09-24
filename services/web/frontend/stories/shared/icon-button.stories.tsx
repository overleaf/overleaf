import IconButton from '@/shared/components/button/icon-button'
import type { Meta } from '@storybook/react'
import { useTranslation } from 'react-i18next'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

type Args = React.ComponentProps<typeof IconButton>

export const Icon = (args: Args) => {
  const { t } = useTranslation()

  return <IconButton accessibilityLabel={t('add')} disabled {...args} />
}

const meta: Meta<typeof IconButton> = {
  title: 'Shared / Components / IconButton',
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
  parameters: figmaDesignUrl(
    'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3460-168934&m=dev'
  ),
}

export default meta
