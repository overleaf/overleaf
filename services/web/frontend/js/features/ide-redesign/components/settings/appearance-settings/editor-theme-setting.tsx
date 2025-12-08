import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { useEditorThemesOptionGroups } from '@/features/editor-left-menu/hooks/use-editor-theme-option-groups'

export default function EditorThemeSetting() {
  const { editorTheme, setEditorTheme } = useProjectSettingsContext()
  const { t } = useTranslation()

  const optGroups = useEditorThemesOptionGroups()

  return (
    <DropdownSetting
      id="editorTheme"
      label={t('editor_theme')}
      description={t('the_code_editor_color_scheme')}
      optgroups={optGroups}
      onChange={setEditorTheme}
      value={editorTheme}
      translateOptions="no"
    />
  )
}
