import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { isInExperiment } from '@/utils/labs-utils'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export const canUseNewEditor = () =>
  isInExperiment('editor-redesign') || isSplitTestEnabled('editor-redesign')

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
