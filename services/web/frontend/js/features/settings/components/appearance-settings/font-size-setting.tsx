import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'

const sizes = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24]
const options = sizes.map(size => ({
  value: size,
  label: `${size}px`,
}))

export default function FontSizeSetting() {
  const { fontSize, setFontSize } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <DropdownSetting
      id="fontSize"
      label={t('editor_font_size')}
      options={options}
      onChange={setFontSize}
      value={fontSize}
    />
  )
}
