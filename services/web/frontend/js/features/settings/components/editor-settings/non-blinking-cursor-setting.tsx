import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function NonBlinkingCursorSetting() {
  const { nonBlinkingCursor, setNonBlinkingCursor } =
    useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="non-blinking-cursor"
      label={t('non_blinking_cursor')}
      description={t('reduces_visual_distraction_by_keeping_the_cursor_solid')}
      checked={nonBlinkingCursor}
      onChange={setNonBlinkingCursor}
    />
  )
}
