import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsAutoCloseBrackets() {
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
      label={t('auto_close_brackets')}
      name="autoPairDelimiters"
    />
  )
}
