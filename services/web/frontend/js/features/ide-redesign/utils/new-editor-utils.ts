import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { isSplitTestEnabled, getSplitTestVariant } from '@/utils/splitTestUtils'

export const ignoringUserCutoffDate =
  new URLSearchParams(window.location.search).get('skip-new-user-check') ===
  'true'

const NEW_USER_CUTOFF_DATE = new Date(Date.UTC(2025, 8, 23, 13, 0, 0)) // 2pm British Summer Time on September 23, 2025

export const isNewUser = () => {
  if (ignoringUserCutoffDate) return true
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
      newUserTestVariant === 'new-editor-old-logs' ||
      newUserTestVariant === 'new-editor-new-logs-old-position')
  )
}

export const canUseNewEditor = () => {
  return (
    canUseNewEditorViaPrimaryFeatureFlag() ||
    canUseNewEditorViaNewUserFeatureFlag()
  )
}

const canUseNewLogsPosition = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')
  const canUseNewLogsViaNewUserFeatureFlag =
    isNewUser() && newUserTestVariant === 'new-editor'

  return (
    canUseNewEditorViaPrimaryFeatureFlag() || canUseNewLogsViaNewUserFeatureFlag
  )
}

const canUseNewLogs = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')
  const canUseNewLogsViaNewUserFeatureFlag =
    isNewUser() &&
    (newUserTestVariant === 'new-editor' ||
      newUserTestVariant === 'new-editor-new-logs-old-position')

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

export const useIsNewErrorLogsPositionEnabled = () => {
  const newEditorEnabled = useIsNewEditorEnabled()
  return newEditorEnabled && canUseNewLogsPosition()
}

export const useAreNewErrorLogsEnabled = () => {
  const newEditorEnabled = useIsNewEditorEnabled()
  return newEditorEnabled && canUseNewLogs()
}

export function useNewEditorVariant() {
  const newEditor = useIsNewEditorEnabled()
  const newErrorLogs = useAreNewErrorLogsEnabled()
  const newErrorLogsPosition = useIsNewErrorLogsPositionEnabled()
  if (!newEditor) return 'default'
  if (!newErrorLogs) return 'new-editor-old-logs'
  if (!newErrorLogsPosition) return 'new-editor-new-logs-old-position'
  return 'new-editor'
}
