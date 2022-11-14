import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import getMeta from '../../../../utils/meta'
import SettingsMenuSelect from './settings-menu-select'
import type { Option } from './settings-menu-select'

type OverallTheme = {
  name: string
  path: string
  val: string
}

export default function SettingsOverallTheme() {
  const { t } = useTranslation()
  const overallThemes = getMeta('ol-overallThemes') as
    | OverallTheme[]
    | undefined
  const { loadingStyleSheet } = useLayoutContext() as {
    loadingStyleSheet: boolean
  }

  const options: Array<Option> = useMemo(
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
    <SettingsMenuSelect
      options={options}
      loading={loadingStyleSheet}
      label={t('overall_theme')}
      name="overallTheme"
    />
  )
}
