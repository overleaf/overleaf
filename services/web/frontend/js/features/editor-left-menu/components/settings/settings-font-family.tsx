import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsFontFamily() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={[
        {
          value: 'monaco',
          label: 'Monaco / Menlo / Consolas',
        },
        {
          value: 'lucida',
          label: 'Lucida / Source Code Pro',
        },
      ]}
      label={t('font_family')}
      name="fontFamily"
    />
  )
}
