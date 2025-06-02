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
      description={t('show_breadcrumbs_in_toolbar')}
      checked={breadcrumbs}
      onChange={setBreadcrumbs}
    />
  )
}
