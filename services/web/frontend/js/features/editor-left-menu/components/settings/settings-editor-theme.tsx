import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import { useEditorThemesOptionGroups } from '../../hooks/use-editor-theme-option-groups'

export default function SettingsEditorTheme() {
  const { t } = useTranslation()
  const { editorTheme, setEditorTheme } = useProjectSettingsContext()

  const optGroups = useEditorThemesOptionGroups()

  return (
    <SettingsMenuSelect
      onChange={setEditorTheme}
      value={editorTheme}
      optgroups={optGroups}
      label={t('editor_theme')}
      name="editorTheme"
      translateOptions="no"
    />
  )
}
