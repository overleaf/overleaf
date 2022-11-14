import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

const sizes = ['10', '11', '12', '13', '14', '16', '18', '20', '22', '24']
const options: Array<Option> = sizes.map(size => ({
  value: size,
  label: `${size}px`,
}))

export default function SettingsFontSize() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={options}
      label={t('font_size')}
      name="fontSize"
    />
  )
}
