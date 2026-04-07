import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function PreviewTabsSetting() {
  const { previewTabs, setPreviewTabs } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="previewTabs"
      label={t('preview_editor_tabs')}
      description={t('tabs_open_in_preview_mode_until_you_interact_with_them')}
      checked={previewTabs}
      onChange={setPreviewTabs}
    />
  )
}
