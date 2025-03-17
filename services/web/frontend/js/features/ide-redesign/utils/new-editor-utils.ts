import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

// TODO: For now we're using the feature flag, but eventually we'll read this
// from labs.
export const canUseNewEditor = () => isSplitTestEnabled('editor-redesign')

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
