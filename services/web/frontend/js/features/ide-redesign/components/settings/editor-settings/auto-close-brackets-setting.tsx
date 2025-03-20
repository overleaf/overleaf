import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import ToggleSetting from '../toggle-setting'
import { useTranslation } from 'react-i18next'

export default function AutoCloseBracketsSetting() {
  const { autoPairDelimiters, setAutoPairDelimiters } =
    useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <ToggleSetting
      id="autoPairDelimiters"
      label={t('auto_close_brackets')}
      description={t('automatically_insert_closing_brackets_and_parentheses')}
      checked={autoPairDelimiters}
      onChange={setAutoPairDelimiters}
    />
  )
}
