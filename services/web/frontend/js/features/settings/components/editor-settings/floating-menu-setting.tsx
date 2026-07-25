import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function FloatingMenuSetting() {
  const { floatingMenu, setFloatingMenu } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="floatingMenu"
      label={t('show_quick_actions_on_text_selection')}
      description=""
      checked={floatingMenu}
      onChange={setFloatingMenu}
    />
  )
}
