import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { isInExperiment } from '@/utils/labs-utils'

export const canUseNewEditor = () => isInExperiment('editor-redesign')

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
