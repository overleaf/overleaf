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

export const canUseNewEditor = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')

  const canUseNewEditorViaPrimaryFeatureFlag =
    isSplitTestEnabled('editor-redesign')
  const canUseNewEditorViaNewUserFeatureFlag =
    isNewUser() &&
    (newUserTestVariant === 'new-editor' ||
      newUserTestVariant === 'new-editor-old-logs')
  return (
    canUseNewEditorViaPrimaryFeatureFlag || canUseNewEditorViaNewUserFeatureFlag
  )
}

const canUseNewLogs = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')
  const canUseNewLogsViaPrimaryFeatureFlag =
    isSplitTestEnabled('editor-redesign')
  const canUseNewLogsViaNewUserFeatureFlag =
    isNewUser() && newUserTestVariant === 'new-editor'

  return (
    canUseNewLogsViaPrimaryFeatureFlag || canUseNewLogsViaNewUserFeatureFlag
  )
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
