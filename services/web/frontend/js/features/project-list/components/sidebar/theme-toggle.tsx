import useSetOverallTheme from '@/features/editor-left-menu/hooks/use-set-overall-theme'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { OverallThemeMeta } from '@ol-types/project-settings'
import { useTranslation } from 'react-i18next'

const getIcon = (theme: OverallThemeMeta) => {
  switch (theme.val) {
    case 'light-':
      return 'light_mode'
    case 'system':
      return 'computer'
    default:
      return 'dark_mode'
  }
}

export default function ThemeToggle() {
  const {
    userSettings: { overallTheme },
  } = useUserSettingsContext()
  const setOverallTheme = useSetOverallTheme()
  const overallThemes = getMeta('ol-overallThemes')
  const { t } = useTranslation()

  return (
    <fieldset className="dropdown-item theme-toggle">
      <legend>{t('theme')}</legend>
      <div className="theme-toggle-radios">
        {overallThemes.map(theme => (
          <OLTooltip
            key={theme.val}
            description={theme.name}
            id={`theme-switch-${theme.name}-tooltip`}
          >
            <div className="theme-toggle-radio">
              <input
                id={`theme-switch-${theme.name}`}
                type="radio"
                value={theme.val}
                checked={overallTheme === theme.val}
                onChange={() => setOverallTheme(theme.val)}
              />
              <label htmlFor={`theme-switch-${theme.name}`}>
                <MaterialIcon type={getIcon(theme)} />
              </label>
            </div>
          </OLTooltip>
        ))}
      </div>
    </fieldset>
  )
}
