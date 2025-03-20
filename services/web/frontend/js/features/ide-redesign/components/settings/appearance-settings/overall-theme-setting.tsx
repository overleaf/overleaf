import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import DropdownSetting from '../dropdown-setting'
import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import type { Option } from '../dropdown-setting'
import { useTranslation } from 'react-i18next'
import { OverallThemeMeta } from '../../../../../../../types/project-settings'
import { isIEEEBranded } from '@/utils/is-ieee-branded'
import { useLayoutContext } from '@/shared/context/layout-context'
import { OverallTheme } from '@/shared/utils/styles'

export default function OverallThemeSetting() {
  const { t } = useTranslation()
  const overallThemes = getMeta('ol-overallThemes') as
    | OverallThemeMeta[]
    | undefined

  const { loadingStyleSheet } = useLayoutContext()
  const { overallTheme, setOverallTheme } = useProjectSettingsContext()

  const options: Array<Option<OverallTheme>> = useMemo(
    () =>
      overallThemes?.map(({ name, val }) => ({
        value: val,
        label: name,
      })) ?? [],
    [overallThemes]
  )

  if (!overallThemes || isIEEEBranded()) {
    return null
  }

  return (
    <DropdownSetting
      id="overallTheme"
      label={t('overall_theme')}
      description={t('the_overleaf_color_scheme')}
      options={options}
      onChange={setOverallTheme}
      value={overallTheme}
      loading={loadingStyleSheet}
    />
  )
}
