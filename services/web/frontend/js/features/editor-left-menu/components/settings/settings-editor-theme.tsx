import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

export default function SettingsEditorTheme() {
  const { t } = useTranslation()
  const editorThemes = getMeta('ol-editorThemes') as string[] | undefined
  const legacyEditorThemes = getMeta('ol-legacyEditorThemes') as
    | string[]
    | undefined

  const options = useMemo(() => {
    const editorThemeOptions: Array<Option> =
      editorThemes?.map(theme => ({
        value: theme,
        label: theme.replace(/_/g, ' '),
      })) ?? []

    const dividerOption: Option = {
      value: '-',
      label: '—————————————————',
      ariaHidden: 'true',
      disabled: true,
    }

    const legacyEditorThemeOptions: Array<Option> =
      legacyEditorThemes?.map(theme => ({
        value: theme,
        label: theme.replace(/_/g, ' '),
      })) ?? []

    return [...editorThemeOptions, dividerOption, ...legacyEditorThemeOptions]
  }, [editorThemes, legacyEditorThemes])

  return (
    <SettingsMenuSelect
      label={t('editor_theme')}
      name="editorTheme"
      options={options}
    />
  )
}
