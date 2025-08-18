import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export const canUseNewEditor = () => {
  return isSplitTestEnabled('editor-redesign')
}

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
