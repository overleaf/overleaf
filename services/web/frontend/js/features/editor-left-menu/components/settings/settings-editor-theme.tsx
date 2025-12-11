import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'
import { useEditorThemesOptionGroups } from '../../hooks/use-editor-theme-option-groups'
import { isIEEEBranded } from '@/utils/is-ieee-branded'

export default function SettingsEditorTheme() {
  const { t } = useTranslation()
  const optGroups = useEditorThemesOptionGroups()
  const {
    editorTheme,
    setEditorTheme,
    editorLightTheme,
    editorDarkTheme,
    setEditorLightTheme,
    setEditorDarkTheme,
    overallTheme,
  } = useProjectSettingsContext()

  if (overallTheme === 'system' && !isIEEEBranded()) {
    return (
      <>
        <SettingsMenuSelect
          onChange={setEditorLightTheme}
          value={editorLightTheme}
          optgroups={optGroups}
          label={t('editor_theme_light')}
          name="editorLightTheme"
          translateOptions="no"
        />
        <SettingsMenuSelect
          onChange={setEditorDarkTheme}
          value={editorDarkTheme}
          optgroups={optGroups}
          label={t('editor_theme_dark')}
          name="editorDarkTheme"
          translateOptions="no"
        />
      </>
    )
  }

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
