import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsLineHeight() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={[
        {
          value: 'compact',
          label: t('compact'),
        },
        {
          value: 'normal',
          label: t('normal'),
        },
        {
          value: 'wide',
          label: t('wide'),
        },
      ]}
      label={t('line_height')}
      name="lineHeight"
    />
  )
}
