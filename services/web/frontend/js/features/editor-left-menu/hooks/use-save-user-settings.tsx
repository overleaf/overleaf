import useScopeValue from '../../../shared/hooks/use-scope-value'
import { saveUserSettings } from '../utils/api'
import type { UserSettingsScope } from '../utils/api'

export default function useSaveUserSettings() {
  const [userSettingsScope, setUserSettingsScope] =
    useScopeValue<UserSettingsScope>('settings', true)

  return <T,>(key: keyof UserSettingsScope, newSetting: T) => {
    const currentSetting = userSettingsScope[key]

    if (currentSetting !== newSetting) {
      setUserSettingsScope({ ...userSettingsScope, [key]: newSetting })
      saveUserSettings({ [key]: newSetting })
    }
  }
}
