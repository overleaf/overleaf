import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import { Option } from '../components/settings/settings-menu-select'
import { useTranslation } from 'react-i18next'

const overrides = new Map([['overleaf', 'overleaf light']])
function getThemeName(theme: string): string {
  return (overrides.get(theme) ?? theme).replace(/_/g, ' ')
}

export function useEditorThemesOptionGroups() {
  const editorThemes = getMeta('ol-editorThemes')
  const legacyEditorThemes = getMeta('ol-legacyEditorThemes')
  const { t } = useTranslation()

  const optgroups = useMemo(() => {
    const lightThemes: Array<Option> = []
    const darkThemes: Array<Option> = []

    editorThemes?.forEach(({ name: theme, dark }) => {
      const target = dark ? darkThemes : lightThemes
      target.push({
        value: theme,
        label: getThemeName(theme),
      })
    })

    const legacyEditorThemeOptions: Array<Option> =
      legacyEditorThemes?.map(({ name: theme }) => ({
        value: theme,
        label: getThemeName(theme) + ' (Legacy)',
      })) ?? []

    const groups = []
    if (lightThemes.length > 0) {
      groups.push({ label: t('light_themes'), options: lightThemes })
    }
    if (darkThemes.length > 0) {
      groups.push({ label: t('dark_themes'), options: darkThemes })
    }
    if (legacyEditorThemeOptions.length > 0) {
      groups.push({
        label: t('legacy_themes'),
        options: legacyEditorThemeOptions,
      })
    }
    return groups
  }, [editorThemes, legacyEditorThemes, t])

  return optgroups
}
