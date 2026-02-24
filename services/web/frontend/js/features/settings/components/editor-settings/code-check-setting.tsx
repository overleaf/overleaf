import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function CodeCheckSetting() {
  const { syntaxValidation, setSyntaxValidation } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="syntaxValidation"
      label={t('syntax_validation')}
      description={t('enables_real_time_syntax_checking_in_the_editor')}
      checked={syntaxValidation}
      onChange={setSyntaxValidation}
    />
  )
}
