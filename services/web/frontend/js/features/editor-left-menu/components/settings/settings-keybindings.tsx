import { useTranslation } from 'react-i18next'
import type { Keybindings } from '../../../../../../types/user-settings'
import { useProjectSettingsContext } from '../../context/project-settings-context'
import SettingsMenuSelect from './settings-menu-select'

export default function SettingsKeybindings() {
  const { t } = useTranslation()
  const { mode, setMode } = useProjectSettingsContext()

  return (
    <SettingsMenuSelect<Keybindings>
      onChange={setMode}
      value={mode}
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
