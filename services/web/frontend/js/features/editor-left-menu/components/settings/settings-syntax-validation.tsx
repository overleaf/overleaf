import { useTranslation } from 'react-i18next'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsSyntaxValidation() {
  const { t } = useTranslation()
  const { syntaxValidation, setSyntaxValidation } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<boolean>
      onChange={setSyntaxValidation}
      value={syntaxValidation}
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
      label={t('syntax_validation')}
      name="syntaxValidation"
    />
  )
}
