import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { isInExperiment } from '@/utils/labs-utils'
import getMeta from '@/utils/meta'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export const isNewEditorInBeta = () => {
  const splitTestInfo = getMeta('ol-splitTestInfo') || {}
  return splitTestInfo['editor-redesign']?.phase === 'beta'
}

export const canUseNewEditor = () => {
  const inBetaPhase = isNewEditorInBeta()
  return (
    (!inBetaPhase && isInExperiment('editor-redesign')) ||
    isSplitTestEnabled('editor-redesign')
  )
}

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
