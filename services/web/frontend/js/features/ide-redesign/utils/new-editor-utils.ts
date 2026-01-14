import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'

// For e2e tests purposes, allow overriding to old editor
export const oldEditorOverride =
  new URLSearchParams(window.location.search).get('old-editor-override') ===
  'true'

export const canUseNewEditor = () => {
  return !oldEditorOverride
}

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const noOptOut = useFeatureFlag('editor-redesign-no-opt-out')
  const hasAccess = canUseNewEditor()
  if (!hasAccess) {
    return false
  }
  const enabled = userSettings.enableNewEditor
  if (noOptOut) {
    return true
  }
  return enabled
}

export const useIsNewToNewEditor = () => {
  const { userSettings } = useUserSettingsContext()
  const newEditor = useIsNewEditorEnabled()

  return newEditor && !userSettings.enableNewEditorLegacy
}
