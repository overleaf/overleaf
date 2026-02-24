import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { useEditorThemesOptionGroups } from '@/features/editor-left-menu/hooks/use-editor-theme-option-groups'
import { isIEEEBranded } from '@/utils/is-ieee-branded'

export default function EditorThemeSetting() {
  const {
    editorTheme,
    setEditorTheme,
    editorLightTheme,
    setEditorLightTheme,
    editorDarkTheme,
    setEditorDarkTheme,
    overallTheme,
  } = useProjectSettingsContext()
  const { t } = useTranslation()

  const optGroups = useEditorThemesOptionGroups()

  if (overallTheme === 'system' && !isIEEEBranded()) {
    return (
      <>
        <DropdownSetting
          id="editorLightTheme"
          label={t('editor_theme_light')}
          description={t('the_code_editor_color_scheme_light_mode')}
          optgroups={optGroups}
          onChange={setEditorLightTheme}
          value={editorLightTheme}
          translateOptions="no"
          width="wide"
        />
        <DropdownSetting
          id="editorDarkTheme"
          label={t('editor_theme_dark')}
          description={t('the_code_editor_color_scheme_dark_mode')}
          optgroups={optGroups}
          onChange={setEditorDarkTheme}
          value={editorDarkTheme}
          translateOptions="no"
          width="wide"
        />
      </>
    )
  }

  return (
    <DropdownSetting
      id="editorTheme"
      label={t('editor_theme')}
      description={t('the_code_editor_color_scheme')}
      optgroups={optGroups}
      onChange={setEditorTheme}
      value={editorTheme}
      translateOptions="no"
      width="wide"
    />
  )
}
