import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

const sizes = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24]
const options: Option<number>[] = sizes.map(size => ({
  value: size,
  label: `${size}px`,
}))

export default function SettingsFontSize() {
  const { t } = useTranslation()
  const { fontSize, setFontSize } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect
      onChange={setFontSize}
      value={fontSize}
      options={options}
      label={t('font_size')}
      name="fontSize"
    />
  )
}
