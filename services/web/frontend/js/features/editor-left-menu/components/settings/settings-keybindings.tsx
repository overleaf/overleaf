import { useTranslation } from 'react-i18next'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsKeybindings() {
  const { t } = useTranslation()

  return (
    <SettingsMenuSelect
      options={[
        {
          value: 'default',
          label: 'None',
        },
        {
          value: 'vim',
          label: 'Vim',
        },
        {
          value: 'emacs',
          label: 'Emacs',
        },
      ]}
      label={t('keybindings')}
      name="mode"
    />
  )
}
