import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect, { Option } from './settings-menu-select'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import type { OverallThemeMeta } from '../../../../../../types/project-settings'
import type { OverallTheme } from '../../../source-editor/extensions/theme'

export default function SettingsOverallTheme() {
  const { t } = useTranslation()
  const overallThemes = getMeta('ol-overallThemes') as
    | OverallThemeMeta[]
    | undefined
  const { loadingStyleSheet } = useLayoutContext() as {
    loadingStyleSheet: boolean
  }
  const { overallTheme, setOverallTheme } = useProjectSettingsContext()

  const options: Array<Option<OverallTheme>> = useMemo(
    () =>
      overallThemes?.map(({ name, val }) => ({
        value: val,
        label: name,
      })) ?? [],
    [overallThemes]
  )

  // TODO: check for IEEE brand by:
  // - const brandVariation = getMeta('ol-brandVariation') as any[]
  // - settings.overleaf != null && !isIEEE(brandVariation)
  if (!overallThemes) {
    return null
  }

  return (
    <SettingsMenuSelect<OverallTheme>
      onChange={setOverallTheme}
      value={overallTheme}
      options={options}
      loading={loadingStyleSheet}
      label={t('overall_theme')}
      name="overallTheme"
    />
  )
}
