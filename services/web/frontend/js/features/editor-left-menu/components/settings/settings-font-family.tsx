import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import { FontFamily } from '@/shared/utils/styles'

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
        {
          value: 'opendyslexicmono',
          label: 'OpenDyslexic Mono',
        },
      ]}
      label={t('font_family')}
      name="fontFamily"
      translateOptions="no"
    />
  )
}
