import useScopeValue from '../../../shared/hooks/use-scope-value'
import { saveUserSettings } from '../utils/api'
import type { UserSettings } from '../utils/api'

export default function useSaveUserSettings() {
  const [userSettings, setUserSettings] = useScopeValue<UserSettings>(
    'settings',
    true
  )

  return (
    key: keyof UserSettings,
    newSetting: UserSettings[keyof UserSettings]
  ) => {
    const currentSetting = userSettings[key]

    if (currentSetting !== newSetting) {
      setUserSettings({ ...userSettings, [key]: newSetting })
      saveUserSettings(key, newSetting)
    }
  }
}
