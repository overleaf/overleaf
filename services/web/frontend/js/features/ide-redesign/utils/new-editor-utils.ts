import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { isSplitTestEnabled, getSplitTestVariant } from '@/utils/splitTestUtils'

// TODO: change this when we have a launch date
const NEW_USER_CUTOFF_DATE = new Date('2100-01-01')

const isNewUser = () => {
  const user = getMeta('ol-user')

  if (!user.signUpDate) return false

  const createdAt = new Date(user.signUpDate)
  return createdAt > NEW_USER_CUTOFF_DATE
}

export const canUseNewEditorViaPrimaryFeatureFlag = () => {
  return isSplitTestEnabled('editor-redesign')
}

export const canUseNewEditorViaNewUserFeatureFlag = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')

  return (
    !canUseNewEditorViaPrimaryFeatureFlag() &&
    isNewUser() &&
    (newUserTestVariant === 'new-editor' ||
      newUserTestVariant === 'new-editor-old-logs')
  )
}

export const canUseNewEditor = () => {
  return (
    canUseNewEditorViaPrimaryFeatureFlag() ||
    canUseNewEditorViaNewUserFeatureFlag()
  )
}

const canUseNewLogs = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')
  const canUseNewLogsViaNewUserFeatureFlag =
    isNewUser() && newUserTestVariant === 'new-editor'

  return (
    canUseNewEditorViaPrimaryFeatureFlag() || canUseNewLogsViaNewUserFeatureFlag
  )
}

export const useIsNewEditorEnabledViaPrimaryFeatureFlag = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditorViaPrimaryFeatureFlag()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}

export const useAreNewErrorLogsEnabled = () => {
  const newEditorEnabled = useIsNewEditorEnabled()
  return newEditorEnabled && canUseNewLogs()
}
