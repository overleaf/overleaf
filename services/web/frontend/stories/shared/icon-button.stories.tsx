import OLIconButton from '@/shared/components/ol/ol-icon-button'
import type { Meta } from '@storybook/react-webpack5'
import { useTranslation } from 'react-i18next'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

type Args = React.ComponentProps<typeof OLIconButton>

export const Icon = (args: Args) => {
  const { t } = useTranslation()

  return <OLIconButton accessibilityLabel={t('add')} disabled {...args} />
}

const meta: Meta<typeof OLIconButton> = {
  title: 'Shared / Components / IconButton',
  component: OLIconButton,
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
