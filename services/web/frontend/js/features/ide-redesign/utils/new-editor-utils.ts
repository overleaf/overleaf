import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import getMeta from '@/utils/meta'
import { isSplitTestEnabled, getSplitTestVariant } from '@/utils/splitTestUtils'

const ignoringUserCutoffDate =
  new URLSearchParams(window.location.search).get('skip-new-user-check') ===
  'true'

// For E2E tests, allow forcing a user to be treated as an existing user
const existingUserOverride =
  new URLSearchParams(window.location.search).get('existing-user-override') ===
  'true'

// We don't want to enable the new editor on server-pro/CE until we have fully rolled it out on SaaS
const { isOverleaf } = getMeta('ol-ExposedSettings')

const SPLIT_TEST_USER_CUTOFF_DATE = new Date(Date.UTC(2025, 8, 23, 13, 0, 0)) // 2pm British Summer Time on September 23, 2025
const NEW_USER_CUTOFF_DATE = new Date(Date.UTC(2025, 10, 12, 12, 0, 0)) // 12pm GMT on November 12, 2025

export const isNewUser = () => {
  if (existingUserOverride) return false

  if (ignoringUserCutoffDate) return true
  const user = getMeta('ol-user')

  if (!user.signUpDate) return false

  const createdAt = new Date(user.signUpDate)
  return createdAt > NEW_USER_CUTOFF_DATE
}

export const isSplitTestUser = () => {
  if (existingUserOverride) return false

  const user = getMeta('ol-user')
  if (!user.signUpDate) return false

  const createdAt = new Date(user.signUpDate)
  return (
    createdAt > SPLIT_TEST_USER_CUTOFF_DATE && createdAt <= NEW_USER_CUTOFF_DATE
  )
}

export const canUseNewEditorAsExistingUser = () => {
  return !canUseNewEditorAsNewUser() && isSplitTestEnabled('editor-redesign')
}

export const canUseNewEditorAsNewUser = () => {
  const newUserTestVariant = getSplitTestVariant('editor-redesign-new-users')
  return (
    isOverleaf &&
    (isNewUser() || (isSplitTestUser() && newUserTestVariant !== 'default'))
  )
}

export const canUseNewEditor = () => {
  return canUseNewEditorAsExistingUser() || canUseNewEditorAsNewUser()
}

export const useIsNewEditorEnabledAsExistingUser = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditorAsExistingUser()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}

export const useIsNewEditorEnabled = () => {
  const { userSettings } = useUserSettingsContext()
  const hasAccess = canUseNewEditor()
  const enabled = userSettings.enableNewEditor
  return hasAccess && enabled
}
