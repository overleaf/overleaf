import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'

export default function EditorThemeSetting() {
  const editorThemes = getMeta('ol-editorThemes')
  const legacyEditorThemes = getMeta('ol-legacyEditorThemes')
  const { editorTheme, setEditorTheme } = useProjectSettingsContext()
  const { t } = useTranslation()

  const options = useMemo(() => {
    const editorThemeOptions: Array<Option> =
      editorThemes?.map(theme => ({
        value: theme,
        label: theme.replace(/_/g, ' '),
      })) ?? []

    const dividerOption: Option = {
      value: '-',
      label: '—————————————————',
      disabled: true,
    }

    const legacyEditorThemeOptions: Array<Option> =
      legacyEditorThemes?.map(theme => ({
        value: theme,
        label: theme.replace(/_/g, ' ') + ' (Legacy)',
      })) ?? []

    return [...editorThemeOptions, dividerOption, ...legacyEditorThemeOptions]
  }, [editorThemes, legacyEditorThemes])

  return (
    <DropdownSetting
      id="editorTheme"
      label={t('editor_theme')}
      description={t('the_code_editor_color_scheme')}
      options={options}
      onChange={setEditorTheme}
      value={editorTheme}
    />
  )
}
