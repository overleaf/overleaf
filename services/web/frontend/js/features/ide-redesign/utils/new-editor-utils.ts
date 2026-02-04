import { useUserSettingsContext } from '@/shared/context/user-settings-context'

export const canUseNewEditor = () => {
  return true
}

export const useIsNewEditorEnabled = () => {
  return canUseNewEditor()
}

export const useIsNewToNewEditor = () => {
  const { userSettings } = useUserSettingsContext()
  const newEditor = useIsNewEditorEnabled()

  return newEditor && !userSettings.enableNewEditorLegacy
}
