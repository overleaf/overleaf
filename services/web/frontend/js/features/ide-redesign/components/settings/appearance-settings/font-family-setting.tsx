import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'

export default function FontFamilySetting() {
  const { fontFamily, setFontFamily } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <DropdownSetting
      id="fontFamily"
      label={t('editor_font_family')}
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
      onChange={setFontFamily}
      value={fontFamily}
      width="wide"
      translateOptions="no"
    />
  )
}
