import { useTranslation } from 'react-i18next'
import { FontFamily } from '../../../source-editor/extensions/theme'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsFontFamily() {
  const { t } = useTranslation()
  const { fontFamily, setFontFamily } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<FontFamily>
      onChange={setFontFamily}
      value={fontFamily}
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
