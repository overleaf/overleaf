import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'

// For e2e tests purposes, allow overriding to old editor
export const oldEditorOverride =
  new URLSearchParams(window.location.search).get('old-editor-override') ===
  'true'

// We don't want to enable the new editor on server-pro/CE until we have fully rolled it out on SaaS
const { isOverleaf } = getMeta('ol-ExposedSettings')

export const canUseNewEditor = () => {
  return isOverleaf && !oldEditorOverride
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
