import useScopeValue from '../../../shared/hooks/use-scope-value'
import { sendMB } from '../../../infrastructure/event-tracking'
import { saveUserSettings } from '../utils/api'
import type { UserSettingsScope } from '../utils/api'

export default function useSaveUserSettings() {
  const [userSettingsScope, setUserSettingsScope] =
    useScopeValue<UserSettingsScope>('settings', true)

  return (
    key: keyof UserSettingsScope,
    newSetting: UserSettingsScope[keyof UserSettingsScope]
  ) => {
    const currentSetting = userSettingsScope[key]

    sendMB('setting-changed', {
      changedSetting: key,
      changedSettingVal: newSetting,
    })

    if (currentSetting !== newSetting) {
      setUserSettingsScope({ ...userSettingsScope, [key]: newSetting })
      saveUserSettings({ [key]: newSetting })
    }
  }
}
