import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import ToggleSetting from '../toggle-setting'

export default function EditorTabsSetting() {
  const { editorTabs, setEditorTabs } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="editorTabs"
      label={t('open_files_in_tabs')}
      description={t('open_each_file_in_its_own_tab')}
      checked={editorTabs}
      onChange={setEditorTabs}
    />
  )
}
