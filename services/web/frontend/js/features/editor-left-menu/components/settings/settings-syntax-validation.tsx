import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsSyntaxValidation() {
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
      label={t('syntax_validation')}
      name="syntaxValidation"
    />
  )
}
