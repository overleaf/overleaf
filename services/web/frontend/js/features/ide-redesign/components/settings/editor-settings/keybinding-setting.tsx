import { useProjectSettingsContext } from '@/features/editor-left-menu/context/project-settings-context'
import { useTranslation } from 'react-i18next'
import DropdownSetting from '../dropdown-setting'
import { Keybindings } from '../../../../../../../types/user-settings'

const OPTIONS: { value: Keybindings; label: string }[] = [
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
]

export default function KeybindingSetting() {
  const { mode, setMode } = useProjectSettingsContext()
  const { t } = useTranslation()

  return (
    <DropdownSetting
      id="mode"
      label={t('keybindings')}
      description={t('work_in_vim_or_emacs_emulation_mode')}
      options={OPTIONS}
      onChange={setMode}
      value={mode}
    />
  )
}
