import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { saveUserSettings } from '../utils/api'
import { UserSettings } from '../../../../../types/user-settings'

export default function useSaveUserSettings() {
  const { userSettings, setUserSettings } = useUserSettingsContext()

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
