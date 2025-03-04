import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function AutoCompleteSetting() {
  const { autoComplete, setAutoComplete } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="autoComplete"
      label={t('auto_complete')}
      description={t('suggests_code_completions_while_typing')}
      checked={autoComplete}
      onChange={setAutoComplete}
    />
  )
}
