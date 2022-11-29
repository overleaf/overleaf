import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsAutoComplete() {
  const { t } = useTranslation()
  const { autoComplete, setAutoComplete } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect
      onChange={setAutoComplete}
      value={autoComplete}
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
      label={t('auto_complete')}
      name="autoComplete"
    />
  )
}
