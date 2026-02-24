import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function BreadcrumbsSetting() {
  const { breadcrumbs, setBreadcrumbs } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="breadcrumbs-setting"
      label={t('breadcrumbs')}
      description={t('see_your_current_location_in_the_project')}
      checked={breadcrumbs}
      onChange={setBreadcrumbs}
    />
  )
}
