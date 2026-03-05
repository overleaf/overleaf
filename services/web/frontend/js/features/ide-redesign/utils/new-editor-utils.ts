import { useUserSettingsContext } from '@/shared/context/user-settings-context'

export const useIsNewToNewEditor = () => {
  const { userSettings } = useUserSettingsContext()
  return !userSettings.enableNewEditorLegacy
}
