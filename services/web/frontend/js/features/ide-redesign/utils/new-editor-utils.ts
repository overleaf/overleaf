import { useUserSettingsContext } from '@/shared/context/user-settings-context'

// For e2e tests purposes, allow overriding to old editor
export const oldEditorOverride =
  new URLSearchParams(window.location.search).get('old-editor-override') ===
  'true'

export const canUseNewEditor = () => {
  return !oldEditorOverride
}

export const useIsNewEditorEnabled = () => {
  return canUseNewEditor()
}

export const useIsNewToNewEditor = () => {
  const { userSettings } = useUserSettingsContext()
  const newEditor = useIsNewEditorEnabled()

  return newEditor && !userSettings.enableNewEditorLegacy
}
