import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsAutoCloseBrackets() {
  const { t } = useTranslation()
  const { autoPairDelimiters, setAutoPairDelimiters } =
    useProjectSettingsContext()

  return (
    <SettingsMenuSelect
      onChange={setAutoPairDelimiters}
      value={autoPairDelimiters}
      options={[
        {
          value: true,
          label: t('on'),
        },
        {
          value: false,
          label: t('off'),
        },
      ]}
      label={t('auto_close_brackets')}
      name="autoPairDelimiters"
    />
  )
}
