import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsAutoComplete() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={[
        {
          value: 'true',
          label: t('on'),
        },
        {
          value: 'false',
          label: t('off'),
        },
      ]}
      label={t('auto_complete')}
      name="autoComplete"
    />
  )
}
